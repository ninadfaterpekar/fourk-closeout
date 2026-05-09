/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { initialCloseoutHistory, initialServerOptions } from '../data/mockCloseout'
import {
  createServerInSupabase,
  deactivateServerInSupabase,
  listCloseoutsFromSupabase,
  listServersFromSupabase,
  updateServerInSupabase,
  upsertCloseoutToSupabase,
} from '../lib/supabaseStore'
import { isSupabaseConfigured } from '../lib/supabase'
import type {
  CloseoutRecord,
  EditCloseoutPayload,
  NewCloseoutPayload,
  ServerOption,
} from '../types/closeout'

type CloseoutContextValue = {
  serverOptions: ServerOption[]
  addServerOption: (name: string) => Promise<void>
  updateServerOption: (id: string, name: string) => Promise<void>
  deleteServerOption: (id: string) => Promise<void>
  closeoutHistory: CloseoutRecord[]
  createCloseout: (payload: NewCloseoutPayload) => Promise<CloseoutRecord>
  saveDraft: (payload: NewCloseoutPayload, existingDraftId?: string) => Promise<CloseoutRecord>
  saveCloseoutEdit: (id: string, payload: EditCloseoutPayload) => Promise<void>
  registerDraftAutosaveHandler: (handler: (() => Promise<boolean>) | null) => void
  triggerDraftAutosave: () => Promise<boolean>
}

const CloseoutContext = createContext<CloseoutContextValue | null>(null)

const cloneServerRows = (rows: NewCloseoutPayload['serverRows']) => rows.map((row) => ({ ...row }))
const clonePettyCash = (pettyCashData: NewCloseoutPayload['pettyCashData']) => ({ ...pettyCashData })
const cloneHeader = (headerData: NewCloseoutPayload['headerData']) => ({ ...headerData })

const createCloseoutId = () => `CO-${String(Date.now()).slice(-6)}`

const buildRecord = (id: string, payload: NewCloseoutPayload, createdAt: string): CloseoutRecord => ({
  id,
  headerData: cloneHeader(payload.headerData),
  serverRows: cloneServerRows(payload.serverRows),
  pettyCashData: clonePettyCash(payload.pettyCashData),
  status: payload.status,
  createdAt,
  submittedAt: payload.status === 'Submitted' ? new Date().toISOString() : undefined,
  editHistory: [],
})

export const CloseoutProvider = ({ children }: { children: ReactNode }) => {
  const [serverOptions, setServerOptions] = useState<ServerOption[]>(initialServerOptions)
  const [closeoutHistory, setCloseoutHistory] = useState<CloseoutRecord[]>(initialCloseoutHistory)
  const draftAutosaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let isMounted = true

    const loadRemoteData = async () => {
      try {
        const [remoteServers, remoteCloseouts] = await Promise.all([
          listServersFromSupabase(),
          listCloseoutsFromSupabase(),
        ])

        if (!isMounted) return

        if (remoteServers) setServerOptions(remoteServers)
        if (remoteCloseouts) setCloseoutHistory(remoteCloseouts)
      } catch (error) {
        console.warn('Supabase load failed, falling back to local mock state.', error)
      }
    }

    loadRemoteData()

    return () => {
      isMounted = false
    }
  }, [])

  const addServerOption = useCallback(async (name: string) => {
    const optimisticServer: ServerOption = { id: `srv-${crypto.randomUUID()}`, name }
    setServerOptions((prev) => [...prev, optimisticServer])

    try {
      const remoteServer = await createServerInSupabase(name)
      if (!remoteServer) return
      setServerOptions((prev) =>
        prev.map((server) => (server.id === optimisticServer.id ? remoteServer : server)),
      )
    } catch (error) {
      console.warn('Supabase server create failed, keeping local server option.', error)
    }
  }, [])

  const updateServerOption = useCallback(async (id: string, name: string) => {
    setServerOptions((prev) => prev.map((server) => (server.id === id ? { ...server, name } : server)))

    try {
      await updateServerInSupabase(id, name)
    } catch (error) {
      console.warn('Supabase server update failed, keeping local update.', error)
    }
  }, [])

  const deleteServerOption = useCallback(async (id: string) => {
    setServerOptions((prev) => prev.filter((server) => server.id !== id))

    try {
      await deactivateServerInSupabase(id)
    } catch (error) {
      console.warn('Supabase server delete failed, keeping local delete.', error)
    }
  }, [])

  const createCloseout = useCallback(async (payload: NewCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    const nextRecord = buildRecord(createCloseoutId(), payload, timestamp)
    if (payload.status === 'Submitted') {
      nextRecord.submittedAt = timestamp
    }

    setCloseoutHistory((prev) => [nextRecord, ...prev])

    try {
      await upsertCloseoutToSupabase(nextRecord)
    } catch (error) {
      console.warn('Supabase closeout create failed, keeping local record.', error)
    }

    return nextRecord
  }, [])

  const saveDraft = useCallback(async (payload: NewCloseoutPayload, existingDraftId?: string) => {
    const timestamp = new Date().toISOString()

    if (!existingDraftId) {
      return createCloseout({ ...payload, status: 'Draft' })
    }

    let updatedRecord: CloseoutRecord | null = null
    setCloseoutHistory((prev) =>
      prev.map((record) => {
        if (record.id !== existingDraftId) return record

        updatedRecord = {
          ...record,
          headerData: cloneHeader(payload.headerData),
          serverRows: cloneServerRows(payload.serverRows),
          pettyCashData: clonePettyCash(payload.pettyCashData),
          status: 'Draft',
          submittedAt: undefined,
          createdAt: record.createdAt || timestamp,
        }
        return updatedRecord
      }),
    )

    const finalRecord = updatedRecord ?? buildRecord(existingDraftId, { ...payload, status: 'Draft' }, timestamp)

    if (!updatedRecord) {
      setCloseoutHistory((prev) => [finalRecord, ...prev])
    }

    try {
      await upsertCloseoutToSupabase(finalRecord)
    } catch (error) {
      console.warn('Supabase draft save failed, keeping local draft.', error)
    }

    return finalRecord
  }, [createCloseout])

  const saveCloseoutEdit = useCallback(async (id: string, payload: EditCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    let editedRecord: CloseoutRecord | null = null

    setCloseoutHistory((prev) =>
      prev.map((record) => {
        if (record.id !== id) return record

        editedRecord = {
          ...record,
          headerData: cloneHeader(payload.headerData),
          serverRows: cloneServerRows(payload.serverRows),
          pettyCashData: clonePettyCash(payload.pettyCashData),
          status: payload.status,
          submittedAt: payload.status === 'Submitted' ? record.submittedAt ?? timestamp : undefined,
          editHistory: [
            {
              id: `note-${crypto.randomUUID()}`,
              timestamp,
              reason: payload.reason,
            },
            ...record.editHistory,
          ],
        }

        return editedRecord
      }),
    )

    if (!editedRecord) return

    try {
      await upsertCloseoutToSupabase(editedRecord, payload.reason)
    } catch (error) {
      console.warn('Supabase closeout edit failed, keeping local edit.', error)
    }
  }, [])

  const registerDraftAutosaveHandler = useCallback((handler: (() => Promise<boolean>) | null) => {
    draftAutosaveHandlerRef.current = handler
  }, [])

  const triggerDraftAutosave = useCallback(async () => {
    if (!draftAutosaveHandlerRef.current) return false
    return draftAutosaveHandlerRef.current()
  }, [])

  const value = useMemo(
    () => ({
      serverOptions,
      addServerOption,
      updateServerOption,
      deleteServerOption,
      closeoutHistory,
      createCloseout,
      saveDraft,
      saveCloseoutEdit,
      registerDraftAutosaveHandler,
      triggerDraftAutosave,
    }),
    [
      serverOptions,
      addServerOption,
      updateServerOption,
      deleteServerOption,
      closeoutHistory,
      createCloseout,
      saveDraft,
      saveCloseoutEdit,
      registerDraftAutosaveHandler,
      triggerDraftAutosave,
    ],
  )

  return <CloseoutContext.Provider value={value}>{children}</CloseoutContext.Provider>
}

export const useCloseoutContext = () => {
  const context = useContext(CloseoutContext)
  if (!context) {
    throw new Error('useCloseoutContext must be used within CloseoutProvider')
  }
  return context
}
