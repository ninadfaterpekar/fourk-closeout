import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { CloseoutProvider } from './app/CloseoutContext'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CloseoutProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CloseoutProvider>
  </StrictMode>,
)
