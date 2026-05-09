import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCloseoutContext } from '../app/CloseoutContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SectionTitle } from '../components/ui/SectionTitle'

export const AdminSettingsPage = () => {
  const { serverOptions, addServerOption, updateServerOption, deleteServerOption } = useCloseoutContext()
  const [newServerName, setNewServerName] = useState('')
  const [editingServerId, setEditingServerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [storeName, setStoreName] = useState(() => window.localStorage.getItem('fourk.settings.storeName') ?? 'Fourk Grill - Midtown')
  const [defaultPettyCashFloat, setDefaultPettyCashFloat] = useState(
    () => window.localStorage.getItem('fourk.settings.defaultPettyCashFloat') ?? '300',
  )

  useEffect(() => {
    if (!errorToast) return
    const timeoutId = window.setTimeout(() => setErrorToast(''), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [errorToast])

  useEffect(() => {
    if (!successToast) return
    const timeoutId = window.setTimeout(() => setSuccessToast(''), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [successToast])

  const handleSaveSettings = () => {
    window.localStorage.setItem('fourk.settings.storeName', storeName.trim() || 'Fourk Grill - Midtown')
    window.localStorage.setItem('fourk.settings.defaultPettyCashFloat', defaultPettyCashFloat.trim() || '300')
    setSuccessToast('Settings saved.')
  }

  const handleAddServer = async () => {
    const cleaned = newServerName.trim()
    if (!cleaned) return
    try {
      await addServerOption(cleaned)
    } catch (error) {
      console.error('Failed to add server in Supabase.', error)
      setErrorToast('Could not add server. Please try again.')
      return
    }
    setNewServerName('')
  }

  const startEdit = (id: string, name: string) => {
    setEditingServerId(id)
    setEditingName(name)
  }

  const saveEdit = async () => {
    if (!editingServerId) return
    const cleaned = editingName.trim()
    if (!cleaned) return
    try {
      await updateServerOption(editingServerId, cleaned)
    } catch (error) {
      console.error('Failed to update server in Supabase.', error)
      setErrorToast('Could not update server. Please try again.')
      return
    }
    setEditingServerId(null)
    setEditingName('')
  }

  const handleDeleteServer = async (id: string) => {
    try {
      await deleteServerOption(id)
    } catch (error) {
      console.error('Failed to delete server in Supabase.', error)
      setErrorToast('Could not delete server. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        eyebrow="Configuration"
        title="Admin Settings"
        description="Store-level defaults and server roster management. Local-only state for now."
      />

      <Card title="Default Shift Settings">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Store Name</span>
            <input
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Default Petty Cash Float</span>
            <input
              value={defaultPettyCashFloat}
              onChange={(event) => setDefaultPettyCashFloat(event.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={handleSaveSettings}>
            Save Settings
          </Button>
        </div>
      </Card>

      <Card title="Server Management" subtitle="These names power the standard server dropdown in New Closeout.">
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={newServerName}
            onChange={(event) => setNewServerName(event.target.value)}
            placeholder="Add new server name"
            className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <Button type="button" className="px-3 py-2 text-xs" onClick={() => void handleAddServer()}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Server
          </Button>
        </div>

        <div className="space-y-2">
          {serverOptions.map((server) => (
            <div key={server.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
              {editingServerId === server.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                  <Button type="button" className="px-2.5 py-1.5 text-xs" onClick={() => void saveEdit()}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => {
                      setEditingServerId(null)
                      setEditingName('')
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm text-slate-800">{server.name}</p>
                  <button
                    type="button"
                    onClick={() => startEdit(server.id, server.name)}
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Edit server"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteServer(server.id)}
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete server"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      {errorToast && (
        <div className="fixed bottom-5 right-6 z-[60] rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-red-700/35">
          {errorToast}
        </div>
      )}
      {successToast && (
        <div className="fixed bottom-5 right-6 z-[60] rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-slate-900/35">
          {successToast}
        </div>
      )}
    </div>
  )
}
