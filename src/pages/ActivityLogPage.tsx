import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '../app/AuthContext'
import { useCloseoutContext } from '../app/CloseoutContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SectionTitle } from '../components/ui/SectionTitle'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { listActivityLogsFromSupabase } from '../lib/supabaseStore'
import type { ActivityLogEntry } from '../types/activity'
import { formatDateTimeShort } from '../utils/date'

const REAL_RESTAURANT_ID = '24aca723-2050-436c-b42b-c83e23428b1e'

export const ActivityLogPage = () => {
  const { user } = useAuthContext()
  const { activeRestaurantId } = useCloseoutContext()
  const [logs, setLogs] = useState<ActivityLogEntry[]>(() => [])
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const data = await listActivityLogsFromSupabase()
      setLogs(data ?? [])
      setError('')
    } catch (loadError) {
      console.error('Failed to load activity logs.', loadError)
      setError('Could not load activity logs.')
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLogs()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadLogs])

  const insertTestLog = async () => {
    if (!isSupabaseConfigured || !supabase || !user) return

    const payload = {
      restaurant_id: activeRestaurantId ?? REAL_RESTAURANT_ID,
      actor_pin: '192588',
      actor_name: 'Master Admin',
      actor_role: 'super_admin',
      action: 'test_log',
      entity_type: 'system',
      entity_id: null,
      details: {
        message: 'Activity log test',
      },
    }

    try {
      console.log('Test log insert payload', payload)
      const response = await supabase.from('activity_logs').insert(payload).select('*')
      console.log('Test log insert response', response)
      if (response.error) {
        console.error('Test log insert error', response.error)
        return
      }
      await loadLogs()
    } catch (insertError) {
      console.error('Failed to insert test activity log.', insertError)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        eyebrow="Audit"
        title="Activity Log"
        description="Super Admin event history for server and closeout actions."
        actions={
          user?.role === 'super_admin' ? (
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => void insertTestLog()}
            >
              Test Log
            </Button>
          ) : undefined
        }
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
                    <td className="py-2 px-2 text-slate-700">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </td>
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
