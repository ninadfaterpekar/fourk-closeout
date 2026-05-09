import { useEffect, useState } from 'react'
import { History, Settings, UtensilsCrossed } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCloseoutContext } from '../app/CloseoutContext'

const navItems = [
  { to: '/closeout-history', label: 'Closeout History', icon: History },
  { to: '/admin-settings', label: 'Admin Settings', icon: Settings },
]

export const AppLayout = () => {
  const location = useLocation()
  const { triggerDraftAutosave } = useCloseoutContext()
  const [showDraftToast, setShowDraftToast] = useState(false)

  useEffect(() => {
    if (!showDraftToast) return
    const timeoutId = window.setTimeout(() => setShowDraftToast(false), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [showDraftToast])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_44%),radial-gradient(circle_at_85%_10%,rgba(20,184,166,0.14),transparent_35%),linear-gradient(180deg,#f5f3ef_0%,#ece8e0_100%)] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1400px] gap-5 p-4 sm:p-5 lg:p-6">
        <aside className="w-[260px] flex-none rounded-2xl border border-slate-800/10 bg-white/80 p-4 shadow-xl shadow-slate-800/10 backdrop-blur-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-300/50">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fourk</p>
              <h1 className="text-lg font-bold leading-tight text-slate-900">Closeout</h1>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => {
                  const navigatingFromNewCloseout = location.pathname === '/new-closeout' && to !== '/new-closeout'
                  if (navigatingFromNewCloseout) {
                    const saved = triggerDraftAutosave()
                    if (saved) {
                      setShowDraftToast(true)
                    }
                  }
                }}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-900/30'
                      : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 rounded-2xl border border-slate-800/10 bg-white/80 p-4 shadow-xl shadow-slate-800/10 backdrop-blur-lg sm:p-5">
          <Outlet />
        </main>
      </div>

      {showDraftToast && (
        <div className="fixed bottom-5 right-6 z-[60] rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-slate-900/35">
          Draft saved.
        </div>
      )}
    </div>
  )
}
