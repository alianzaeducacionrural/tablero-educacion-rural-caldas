/**
 * Web App del tablero de educación rural de Caldas (Gobernación).
 *
 *   GET  ?action=datos        Todas las pestañas de datos. Público y solo lectura (caché de 5 min).
 *   GET  ?action=ping         Comprobación.
 *   POST {token, action, ...} Administración. Enviar con Content-Type: text/plain
 *                             (con application/json el navegador hace un preflight OPTIONS que Apps Script no responde).
 *
 * El token de administración no está aquí: solo su hash SHA-256.
 * El script está atado al Google Sheet, que puede seguir siendo privado: el Web App corre como su dueño.
 */
var TOKEN_SHA256 = '884eb7978bf80fdfaed03e0bef24de58855e406f5fd1b1232390dd0681b66e94';

var HOJAS_DATOS = ['mf_base', 'uc_base', 'beneficiados', 'estudiantes', 'metas_mf', 'metas_uc', 'mapa_proyectos', 'alias'];
var HOJA_AUDITORIA = 'auditoria';
var CACHE_TTL = 300;
var CACHE_CHUNK = 40000; // caracteres; con tildes (2 bytes) queda bajo el límite de 100 KB por clave
var CACHE_PREFIX = 'datos:';

var PROGRAMAS = {
  mf: { hoja: 'mf_base', grupo: 'proyecto', metas: 'metas_mf' },
  uc: { hoja: 'uc_base', grupo: 'proceso', metas: 'metas_uc' }
};

// Dónde vive cada tipo de valor, para poder renombrarlo en todas las pestañas a la vez.
var DESTINOS = {
  municipio: [['mf_base', 'municipio'], ['uc_base', 'municipio'], ['beneficiados', 'municipio'], ['estudiantes', 'municipio']],
  institucion: [['mf_base', 'institucion'], ['uc_base', 'institucion'], ['beneficiados', 'institucion'], ['estudiantes', 'institucion']],
  actividad: [['mf_base', 'actividad'], ['uc_base', 'actividad'], ['metas_mf', 'actividad'], ['metas_uc', 'actividad']],
  proyecto: [['mf_base', 'proyecto'], ['metas_mf', 'proyecto']],
  proceso: [['uc_base', 'proceso'], ['metas_uc', 'proceso']],
  estado: [['mf_base', 'estado'], ['uc_base', 'estado']],
  aportante: [['mf_base', 'aportante'], ['uc_base', 'aportante']],
  sede: [['beneficiados', 'sede']]
};

// ---------------------------------------------------------------- entrada

function doGet(e) {
  try {
    var accion = (e && e.parameter && e.parameter.action) || 'datos';
    if (accion === 'ping') return json_({ ok: true, hora: new Date().toISOString() });
    if (accion === 'datos') return textoJson_(datosEnJson_());
    return json_({ ok: false, error: 'Acción no válida' });
  } catch (err) {
    return json_({ ok: false, error: mensaje_(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var bloqueado = false;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!tokenValido_(req.token)) {
      Utilities.sleep(1500); // frena la fuerza bruta
      return json_({ ok: false, error: 'No autorizado' });
    }
    lock.waitLock(20000);
    bloqueado = true;
    var r = despachar_(req);
    r.accion = req.action; // el cliente comprueba que la respuesta corresponde a SU petición
    limpiarCache_();
    return json_(r);
  } catch (err) {
    return json_({ ok: false, error: mensaje_(err) });
  } finally {
    if (bloqueado) lock.releaseLock();
  }
}

function despachar_(req) {
  switch (req.action) {
    case 'verificar': return { ok: true };
    case 'registrar': return registrar_(req);
    case 'metas_guardar': return metasGuardar_(req);
    case 'alias_guardar': return aliasGuardar_(req);
    case 'sembrar': return sembrar_(req);
    default: throw new Error('Acción no válida: ' + req.action);
  }
}

// ---------------------------------------------------------------- lectura

function leerDatos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = {};
  HOJAS_DATOS.forEach(function (nombre) {
    var h = ss.getSheetByName(nombre);
    if (!h || h.getLastRow() < 1) {
      hojas[nombre] = { columnas: [], filas: [] };
      return;
    }
    var v = h.getDataRange().getValues();
    hojas[nombre] = { columnas: v[0], filas: v.slice(1) };
  });
  return { ok: true, generado: new Date().toISOString(), hojas: hojas };
}

function datosEnJson_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(CACHE_PREFIX + 'n'));
  if (n > 0) {
    var claves = [];
    for (var i = 0; i < n; i++) claves.push(CACHE_PREFIX + i);
    var partes = cache.getAll(claves);
    var texto = '';
    var completo = true;
    for (var j = 0; j < n; j++) {
      var p = partes[CACHE_PREFIX + j];
      if (p == null) { completo = false; break; }
      texto += p;
    }
    if (completo) return texto;
  }
  var nuevo = JSON.stringify(leerDatos_());
  try {
    var trozos = {};
    var total = Math.ceil(nuevo.length / CACHE_CHUNK);
    for (var k = 0; k < total; k++) trozos[CACHE_PREFIX + k] = nuevo.substr(k * CACHE_CHUNK, CACHE_CHUNK);
    trozos[CACHE_PREFIX + 'n'] = String(total);
    cache.putAll(trozos, CACHE_TTL);
  } catch (err) { /* sin caché sigue funcionando, solo más lento */ }
  return nuevo;
}

function limpiarCache_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(CACHE_PREFIX + 'n')) || 0;
  var claves = [CACHE_PREFIX + 'n'];
  for (var i = 0; i < n; i++) claves.push(CACHE_PREFIX + i);
  cache.removeAll(claves);
}

// ---------------------------------------------------------------- acciones de administración

/** Añade una actividad a mf_base / uc_base validando contra lo que ya existe. */
function registrar_(req) {
  var cfg = PROGRAMAS[req.programa];
  if (!cfg) throw new Error('Programa no válido');
  // Si la respuesta se pierde (pasa con las redirecciones de Apps Script) el cliente reintenta con la misma
  // clave: aquí se devuelve lo ya registrado en vez de escribir la fila otra vez.
  var idem = req.idem ? 'idem:' + String(req.idem).replace(/[^\w-]/g, '').slice(0, 64) : '';
  if (idem) {
    var previo = CacheService.getScriptCache().get(idem);
    if (previo) {
      var r0 = JSON.parse(previo);
      r0.repetido = true;
      return r0;
    }
  }
  var f = req.fila || {};
  var t = tabla_(cfg.hoja);
  var alias = aliasMapa_();

  var vals = {
    anio: entero_(f.anio, 'anio', 2020, 2100),
    municipio: existente_(t, 'municipio', texto_(f.municipio, 'municipio', true)),
    institucion: nuevoOExistente_(t, 'institucion', aplicarAlias_(alias, 'institucion', f.municipio, texto_(f.institucion, 'institucion', true))),
    estado: existente_(t, 'estado', texto_(f.estado, 'estado', true)),
    actividad: nuevoOExistente_(t, 'actividad', aplicarAlias_(alias, 'actividad', '', texto_(f.actividad, 'actividad', true))),
    asistio: !(f.asistio === false || String(f.asistio).toUpperCase() === 'FALSE'),
    cantidad: numero_(f.cantidad, 'cantidad'),
    valor: numero_(f.valor, 'valor'),
    aportante: existente_(t, 'aportante', texto_(f.aportante, 'aportante', true))
  };
  vals[cfg.grupo] = existente_(t, cfg.grupo, texto_(f[cfg.grupo], cfg.grupo, true));
  vals.tipo_beneficiario = texto_(f.tipo_beneficiario, 'tipo_beneficiario', false) || tipoBeneficiario_(vals.institucion);

  var fila = t.columnas.map(function (c) {
    if (!(c in vals)) throw new Error('La hoja ' + cfg.hoja + ' tiene una columna inesperada: ' + c);
    return vals[c];
  });
  var h = t.hoja;
  var destino = h.getLastRow() + 1;
  h.getRange(destino, 1, 1, fila.length).setValues([fila]);
  auditar_('registrar', { hoja: cfg.hoja, fila: destino, valores: vals }, req.quien);
  var resultado = { ok: true, hoja: cfg.hoja, fila: destino, valores: vals };
  if (idem) CacheService.getScriptCache().put(idem, JSON.stringify(resultado), 21600);
  return resultado;
}

/** Crea o actualiza metas por (vigencia, proyecto|proceso, actividad). Recalcula las columnas derivadas. */
function metasGuardar_(req) {
  var cfg = PROGRAMAS[req.programa];
  if (!cfg) throw new Error('Programa no válido');
  var filas = req.filas;
  if (!Array.isArray(filas) || !filas.length || filas.length > 200) throw new Error('Envía entre 1 y 200 filas');
  var editables = ['valor_unitario', 'meta', 'ejecutado', 'adicional'];
  if (req.programa === 'uc') editables = editables.concat(['reinversion', 'departamento', 'comite']);

  var t = tabla_(cfg.metas);
  var indice = {};
  t.datos.forEach(function (r, i) {
    indice[claveMeta_(r[t.idx.vigencia], r[t.idx[cfg.grupo]], r[t.idx.actividad])] = i;
  });

  var nuevas = [];
  var actualizadas = 0;
  filas.forEach(function (f) {
    var vig = entero_(f.vigencia, 'vigencia', 2020, 2100);
    var grupo = texto_(f[cfg.grupo], cfg.grupo, true);
    var act = texto_(f.actividad, 'actividad', true);
    var k = claveMeta_(vig, grupo, act);
    var i = indice[k];
    var fila;
    if (i === undefined) {
      fila = t.columnas.map(function () { return ''; });
      fila[t.idx.vigencia] = vig;
      fila[t.idx[cfg.grupo]] = grupo;
      fila[t.idx.actividad] = act;
    } else {
      fila = t.datos[i].slice();
    }
    editables.forEach(function (c) {
      if (f[c] !== undefined && f[c] !== null && f[c] !== '') fila[t.idx[c]] = numero_(f[c], c);
    });
    var vu = Number(fila[t.idx.valor_unitario]) || 0;
    var meta = Number(fila[t.idx.meta]) || 0;
    var ej = Number(fila[t.idx.ejecutado]) || 0;
    fila[t.idx.valor_meta] = Math.round(vu * meta);
    fila[t.idx.valor_ejecutado] = Math.round(vu * ej);
    fila[t.idx.faltante] = meta - ej;
    fila[t.idx.valor_faltante] = Math.round(vu * Math.max(0, meta - ej));
    if (i === undefined) {
      indice[k] = t.datos.length + nuevas.length;
      nuevas.push(fila);
    } else {
      t.hoja.getRange(i + 2, 1, 1, fila.length).setValues([fila]);
      actualizadas++;
    }
  });
  if (nuevas.length) {
    t.hoja.getRange(t.hoja.getLastRow() + 1, 1, nuevas.length, nuevas[0].length).setValues(nuevas);
  }
  auditar_('metas_guardar', { hoja: cfg.metas, actualizadas: actualizadas, nuevas: nuevas.length }, req.quien);
  return { ok: true, actualizadas: actualizadas, nuevas: nuevas.length };
}

/** Registra que `crudo` significa `normalizado` y lo aplica ya mismo en todas las pestañas. */
function aliasGuardar_(req) {
  var tipo = req.tipo;
  if (!DESTINOS[tipo]) throw new Error('Tipo no válido: ' + tipo);
  var ambito = tipo === 'institucion' ? texto_(req.ambito, 'ambito', true) : '';
  var crudo = texto_(req.crudo, 'crudo', true);
  var normalizado = texto_(req.normalizado, 'normalizado', true);
  if (crudo === normalizado) throw new Error('El valor original y el normalizado son iguales');
  // "Convocado - No Asistió" es un estado real (columna asistio), no un duplicado.
  if (/convocado/i.test(crudo) || /convocado/i.test(normalizado)) {
    throw new Error('"Convocado - No Asistió" no se fusiona: se maneja con la columna asistio');
  }
  var cambios = renombrar_(tipo, ambito, crudo, normalizado);
  var h = hoja_('alias');
  h.getRange(h.getLastRow() + 1, 1, 1, 5).setValues([[tipo, ambito, crudo, normalizado, cambios]]);
  auditar_('alias_guardar', { tipo: tipo, ambito: ambito, crudo: crudo, normalizado: normalizado, celdas: cambios }, req.quien);
  return { ok: true, celdas: cambios };
}

/** Carga masiva de una pestaña (la usa el script de siembra). Reemplaza el contenido. */
function sembrar_(req) {
  var nombre = req.hoja;
  if (HOJAS_DATOS.concat([HOJA_AUDITORIA]).indexOf(nombre) < 0) throw new Error('Hoja no permitida: ' + nombre);
  var cols = req.columnas;
  var filas = req.filas || [];
  if (!Array.isArray(cols) || !cols.length || !Array.isArray(filas)) throw new Error('Formato inválido');
  var ancho = cols.length;
  filas.forEach(function (r) { if (!Array.isArray(r) || r.length !== ancho) throw new Error('Una fila no tiene ' + ancho + ' columnas'); });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  h.clear();
  h.clearFormats();
  if (h.getMaxColumns() < ancho) h.insertColumnsAfter(h.getMaxColumns(), ancho - h.getMaxColumns());
  if (h.getMaxRows() < filas.length + 2) h.insertRowsAfter(h.getMaxRows(), filas.length + 2 - h.getMaxRows());
  h.getRange(1, 1, 1, ancho).setValues([cols]).setFontWeight('bold');
  h.setFrozenRows(1);
  if (filas.length) {
    // Las columnas de texto se guardan como texto plano: evita que Sheets convierta "1-2" en fecha, etc.
    for (var c = 0; c < ancho; c++) {
      var esTexto = filas.some(function (r) { return typeof r[c] === 'string' && r[c] !== ''; }) &&
                    filas.every(function (r) { return typeof r[c] === 'string'; });
      if (esTexto) h.getRange(2, c + 1, h.getMaxRows() - 1, 1).setNumberFormat('@');
    }
    h.getRange(2, 1, filas.length, ancho).setValues(filas);
  }
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  auditar_('sembrar', { hoja: nombre, filas: filas.length }, req.quien);
  return { ok: true, hoja: nombre, filas: filas.length };
}

// ---------------------------------------------------------------- utilidades

function renombrar_(tipo, ambito, crudo, nuevo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;
  DESTINOS[tipo].forEach(function (d) {
    var h = ss.getSheetByName(d[0]);
    if (!h || h.getLastRow() < 2) return;
    var cols = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    var ci = cols.indexOf(d[1]);
    if (ci < 0) return;
    var n = h.getLastRow() - 1;
    var col = h.getRange(2, ci + 1, n, 1).getValues();
    var mi = tipo === 'institucion' ? cols.indexOf('municipio') : -1;
    var muni = mi >= 0 ? h.getRange(2, mi + 1, n, 1).getValues() : null;
    var cambios = 0;
    for (var i = 0; i < n; i++) {
      if (limpiar_(col[i][0]) === crudo && (!muni || limpiar_(muni[i][0]) === ambito)) {
        col[i][0] = nuevo;
        cambios++;
      }
    }
    if (cambios) {
      h.getRange(2, ci + 1, n, 1).setValues(col);
      total += cambios;
    }
  });
  return total;
}

function hoja_(nombre) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('No existe la hoja ' + nombre);
  return h;
}

/** Lee una pestaña como {hoja, columnas, idx, datos}. */
function tabla_(nombre) {
  var h = hoja_(nombre);
  var ancho = h.getLastColumn();
  if (!ancho) throw new Error('La hoja ' + nombre + ' está vacía');
  var columnas = h.getRange(1, 1, 1, ancho).getValues()[0];
  var datos = h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow() - 1, ancho).getValues() : [];
  var idx = {};
  columnas.forEach(function (c, i) { idx[c] = i; });
  return { hoja: h, columnas: columnas, idx: idx, datos: datos };
}

function catalogo_(t, columna) {
  var m = {};
  var i = t.idx[columna];
  t.datos.forEach(function (r) { var v = limpiar_(r[i]); if (v) m[plegar_(v)] = v; });
  return m;
}

/** El valor debe existir ya en la hoja (ignora mayúsculas y tildes); devuelve la forma canónica. */
function existente_(t, columna, valor) {
  var cat = catalogo_(t, columna);
  var v = cat[plegar_(valor)];
  if (!v) {
    var opciones = Object.keys(cat).map(function (k) { return cat[k]; }).sort().slice(0, 40).join(', ');
    throw new Error(columna + ' "' + valor + '" no existe. Opciones: ' + opciones);
  }
  return v;
}

function nuevoOExistente_(t, columna, valor) {
  return catalogo_(t, columna)[plegar_(valor)] || valor;
}

function aliasMapa_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('alias');
  var m = {};
  if (!h || h.getLastRow() < 2) return m;
  h.getRange(2, 1, h.getLastRow() - 1, 4).getValues().forEach(function (r) {
    m[[r[0], limpiar_(r[1]), limpiar_(r[2])].join('|')] = limpiar_(r[3]);
  });
  return m;
}

function aplicarAlias_(mapa, tipo, ambito, valor) {
  var a = tipo === 'institucion' ? limpiar_(ambito) : '';
  return mapa[[tipo, a, valor].join('|')] || valor;
}

function tipoBeneficiario_(institucion) {
  var p = plegar_(institucion);
  if (p.indexOf('grupo ') === 0) return 'Grupo de instituciones';
  if (p.indexOf('red de maestros') === 0) return 'Red de maestros';
  if (p.indexOf('formacion docente') === 0 || p.indexOf('microcentro') === 0) return 'Microcentro / formación docente';
  return 'Institución';
}

function claveMeta_(vigencia, grupo, actividad) {
  return Number(vigencia) + '|' + plegar_(grupo) + '|' + plegar_(actividad);
}

function auditar_(accion, detalle, quien) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_AUDITORIA);
  if (!h) h = SpreadsheetApp.getActiveSpreadsheet().insertSheet(HOJA_AUDITORIA);
  if (h.getLastRow() === 0) h.getRange(1, 1, 1, 4).setValues([['fecha', 'usuario', 'accion', 'detalle']]).setFontWeight('bold');
  var texto = JSON.stringify(detalle);
  h.getRange(h.getLastRow() + 1, 1, 1, 4).setValues([[
    new Date().toISOString(),
    limpiar_(quien || 'admin').slice(0, 80),
    accion,
    (texto.length > 500 ? texto.slice(0, 497) + '...' : texto).replace(/^[=+@-]/, "'$&")
  ]]);
}

function limpiar_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

function plegar_(s) {
  return limpiar_(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function texto_(v, campo, obligatorio) {
  var s = limpiar_(v);
  if (!s) {
    if (obligatorio) throw new Error('Falta ' + campo);
    return '';
  }
  if (s.length > 200) throw new Error(campo + ' es demasiado largo');
  if (/^[=+@]/.test(s)) throw new Error(campo + ' no puede empezar con = + o @');
  return s;
}

function numero_(v, campo) {
  var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(',', '.'));
  if (v === '' || v == null || !isFinite(n) || n < 0) throw new Error(campo + ' debe ser un número mayor o igual a 0');
  return n;
}

function entero_(v, campo, min, max) {
  var n = Number(v);
  if (v === '' || v == null || !isFinite(n) || Math.floor(n) !== n || n < min || n > max) {
    throw new Error(campo + ' debe ser un año entero entre ' + min + ' y ' + max);
  }
  return n;
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); })
    .join('');
}

function tokenValido_(token) {
  return typeof token === 'string' && token.length >= 32 && sha256_(token) === TOKEN_SHA256;
}

function mensaje_(err) {
  return String((err && err.message) || err);
}

function textoJson_(texto) {
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return textoJson_(JSON.stringify(obj));
}
