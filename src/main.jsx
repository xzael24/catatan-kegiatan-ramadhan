import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/global.css'
import App from './App.jsx'

// Check for updates every hour
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Ada update baru tersedia. Muat ulang?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App siap untuk offline mode!')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
