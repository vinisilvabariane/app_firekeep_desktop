import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// A mesma interface atende duas janelas do Electron: o app completo e o
// miniplayer do pomodoro (?view=mini), que carrega so o que precisa.
const isMiniPlayer = new URLSearchParams(window.location.search).get('view') === 'mini'

const { default: Root } = isMiniPlayer
  ? await import('./features/pomodoro/MiniPlayer.jsx')
  : await import('./app/App.jsx')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
