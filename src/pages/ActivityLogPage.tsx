import { useEffect, useState } from 'react'
import { useCloseoutContext } from '../app/CloseoutContext'
import { Card } from '../components/ui/Card'
import { SectionTitle } from '../components/ui/SectionTitle'
import { isSupabaseConfigured } from '../lib/supabase'
import { listActivityLogsFromSupabase } from '../lib/supabaseStore'
import type { ActivityLogEntry } from '../types/activity'
import { formatDateTimeShort } from '../utils/date'

export const ActivityLogPage = () => {
  const { activeRestaurantId } = useCloseoutContext()
  const [logs, setLogs] = useState<ActivityLogEntry[]>(() => [])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let isMounted = true

    const loadLogs = async () => {
      if (!activeRestaurantId) return

      try {
        const data = await listActivityLogsFromSupabase(activeRestaurantId)
        if (!isMounted) return
        setLogs(data ?? [])
        setError('')
      } catch (loadError) {
        console.error('Failed to load activity logs.', loadError)
        if (!isMounted) return
        setError('Could not load activity logs.')
      }
    }

    void loadLogs()
    return () => {
      isMounted = false
    }
  }, [activeRestaurantId])

  return (
    <div className="space-y-4">
      <SectionTitle
        eyebrow="Audit"
        title="Activity Log"
        description="Super Admin event history for server and closeout actions."
      />

      <Card>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isSupabaseConfigured && (
          <p className="text-sm text-slate-600">
            Supabase environment variables are missing. Activity log is unavailable in local mock mode.
          </p>
        )}

        {isSupabaseConfigured && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <th className="pb-2 pr-2">Date / Time</th>
                  <th className="pb-2 px-2">User</th>
                  <th className="pb-2 px-2">Action</th>
                  <th className="pb-2 px-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 text-sm">
                    <td className="py-2 pr-2 text-slate-700">{formatDateTimeShort(log.createdAt)}</td>
                    <td className="py-2 px-2 text-slate-700">{log.actorName}</td>
                    <td className="py-2 px-2 text-slate-700">{log.action}</td>
                    <td className="py-2 px-2 text-slate-700">{log.details}</td>
                  </tr>
                ))}

                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-slate-500">
                      No activity logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
