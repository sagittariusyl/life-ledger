import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

if (import.meta.env.PROD) {
  let session
  const connect = () => { session?.close(); session = new EventSource('/__life_ledger_session') }
  window.addEventListener('pageshow', connect)
  window.addEventListener('pagehide', () => session?.close())
  connect()
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
