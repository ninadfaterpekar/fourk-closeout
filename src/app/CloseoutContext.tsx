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
  const [serverOptions, setServerOptions] = useState<ServerOption[]>(
    isSupabaseConfigured ? [] : initialServerOptions,
  )
  const [closeoutHistory, setCloseoutHistory] = useState<CloseoutRecord[]>(
    isSupabaseConfigured ? [] : initialCloseoutHistory,
  )
  const draftAutosaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)

  const refreshServersFromSupabase = useCallback(async () => {
    const remoteServers = await listServersFromSupabase()
    if (remoteServers) {
      setServerOptions(remoteServers)
    }
  }, [])

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
        console.error('Supabase load failed.', error)
      }
    }

    loadRemoteData()

    return () => {
      isMounted = false
    }
  }, [])

  const addServerOption = useCallback(async (name: string) => {
    if (!isSupabaseConfigured) {
      const localServer: ServerOption = { id: `srv-${crypto.randomUUID()}`, name }
      setServerOptions((prev) => [...prev, localServer])
      return
    }

    try {
      await createServerInSupabase(name)
      await refreshServersFromSupabase()
    } catch (error) {
      console.error('Supabase server create failed.', error)
      throw error
    }
  }, [refreshServersFromSupabase])

  const updateServerOption = useCallback(async (id: string, name: string) => {
    if (!isSupabaseConfigured) {
      setServerOptions((prev) => prev.map((server) => (server.id === id ? { ...server, name } : server)))
      return
    }

    try {
      await updateServerInSupabase(id, name)
      await refreshServersFromSupabase()
    } catch (error) {
      console.error('Supabase server update failed.', error)
      throw error
    }
  }, [refreshServersFromSupabase])

  const deleteServerOption = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) {
      setServerOptions((prev) => prev.filter((server) => server.id !== id))
      return
    }

    try {
      await deactivateServerInSupabase(id)
      await refreshServersFromSupabase()
    } catch (error) {
      console.error('Supabase server delete failed.', error)
      throw error
    }
  }, [refreshServersFromSupabase])

  const createCloseout = useCallback(async (payload: NewCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    const nextRecord = buildRecord(createCloseoutId(), payload, timestamp)
    if (payload.status === 'Submitted') {
      nextRecord.submittedAt = timestamp
    }

    if (isSupabaseConfigured) {
      await upsertCloseoutToSupabase(nextRecord)
    }

    setCloseoutHistory((prev) => [nextRecord, ...prev])

    return nextRecord
  }, [])

  const saveDraft = useCallback(async (payload: NewCloseoutPayload, existingDraftId?: string) => {
    const timestamp = new Date().toISOString()
    const draftId = existingDraftId ?? createCloseoutId()
    const existingDraft = existingDraftId
      ? closeoutHistory.find((record) => record.id === existingDraftId)
      : undefined

    const finalRecord: CloseoutRecord = {
      ...(existingDraft ?? {
        id: draftId,
        createdAt: timestamp,
        editHistory: [],
      }),
      id: draftId,
      headerData: cloneHeader(payload.headerData),
      serverRows: cloneServerRows(payload.serverRows),
      pettyCashData: clonePettyCash(payload.pettyCashData),
      status: 'Draft',
      submittedAt: undefined,
      createdAt: existingDraft?.createdAt ?? timestamp,
      editHistory: existingDraft?.editHistory ?? [],
    }

    if (isSupabaseConfigured) {
      await upsertCloseoutToSupabase(finalRecord)
    }

    setCloseoutHistory((prev) => {
      const existingIndex = prev.findIndex((record) => record.id === draftId)
      if (existingIndex === -1) return [finalRecord, ...prev]
      return prev.map((record) => (record.id === draftId ? finalRecord : record))
    })

    return finalRecord
  }, [closeoutHistory])

  const saveCloseoutEdit = useCallback(async (id: string, payload: EditCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    const existingRecord = closeoutHistory.find((record) => record.id === id)
    if (!existingRecord) return

    const editedRecord: CloseoutRecord = {
      ...existingRecord,
      headerData: cloneHeader(payload.headerData),
      serverRows: cloneServerRows(payload.serverRows),
      pettyCashData: clonePettyCash(payload.pettyCashData),
      status: payload.status,
      submittedAt: payload.status === 'Submitted' ? existingRecord.submittedAt ?? timestamp : undefined,
      editHistory: [
        {
          id: `note-${crypto.randomUUID()}`,
          timestamp,
          reason: payload.reason,
        },
        ...existingRecord.editHistory,
      ],
    }

    if (isSupabaseConfigured) {
      await upsertCloseoutToSupabase(editedRecord, payload.reason)
    }

    setCloseoutHistory((prev) =>
      prev.map((record) => (record.id === id ? editedRecord : record)),
    )
  }, [closeoutHistory])

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
