import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { AuthProvider } from './app/AuthContext'
import { CloseoutProvider } from './app/CloseoutContext'
import { runSupabaseHealthCheck } from './lib/supabaseHealth'
import './styles/index.css'

void runSupabaseHealthCheck()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CloseoutProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CloseoutProvider>
    </AuthProvider>
  </StrictMode>,
)
