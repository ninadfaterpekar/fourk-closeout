import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../app/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { loginWithPin } = useAuthContext()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError('')

    try {
      const success = await loginWithPin(pin.trim())
      if (!success) {
        setError('Invalid PIN')
        return
      }
      navigate('/closeout-history', { replace: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_44%),radial-gradient(circle_at_85%_10%,rgba(20,184,166,0.14),transparent_35%),linear-gradient(180deg,#f5f3ef_0%,#ece8e0_100%)] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-300/50">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fourk</p>
                <h1 className="text-lg font-bold leading-tight text-slate-900">Closeout</h1>
              </div>
            </div>

            <p className="mb-3 text-sm text-slate-600">Enter PIN to unlock the app.</p>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleLogin()
                  }
                }}
                className={`h-9 w-full rounded-md border px-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                  error
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
                }`}
              />
            </label>
            {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => void handleLogin()}>
                Unlock
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
