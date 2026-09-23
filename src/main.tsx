import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/albert-sans'
import '@fontsource-variable/bricolage-grotesque/wdth.css'
import '@fontsource-variable/spline-sans-mono'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
