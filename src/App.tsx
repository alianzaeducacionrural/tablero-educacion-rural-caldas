import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DatosProvider } from './lib/datos'
import { FiltrosProvider } from './lib/filtros'
import { Admin } from './paginas/Admin'
import { Cobertura } from './paginas/Cobertura'
import { Cumplimiento } from './paginas/Cumplimiento'
import { Estudiantes } from './paginas/Estudiantes'
import { Programa } from './paginas/Programa'
import { Resumen } from './paginas/Resumen'

export default function App() {
  return (
    <DatosProvider>
      <FiltrosProvider>
        {/* HashRouter: GitHub Pages no reescribe rutas, así que /#/modelos-flexibles evita el 404 al recargar. */}
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Resumen />} />
              <Route path="modelos-flexibles" element={<Programa key="mf" programa="mf" />} />
              <Route path="universidad-en-el-campo" element={<Programa key="uc" programa="uc" />} />
              <Route path="estudiantes" element={<Estudiantes />} />
              <Route path="cobertura" element={<Cobertura />} />
              <Route path="cumplimiento" element={<Cumplimiento />} />
              <Route path="admin" element={<Admin />} />
              <Route path="*" element={<Resumen />} />
            </Route>
          </Routes>
        </HashRouter>
      </FiltrosProvider>
    </DatosProvider>
  )
}
