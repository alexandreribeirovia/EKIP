// import React from 'react' - Removido temporariamente (StrictMode desabilitado)
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './styles/main.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> - TEMPORARIAMENTE DESABILITADO para corrigir problema de focus loss
  <BrowserRouter>
    <App />
  </BrowserRouter>
  // </React.StrictMode>
  ,
) 