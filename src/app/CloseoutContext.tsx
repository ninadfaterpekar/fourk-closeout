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
  FALLBACK_RESTAURANT_ID,
  createActivityLogInSupabase,
  createServerInSupabase,
  deactivateServerInSupabase,
  deleteCloseoutFromSupabase,
  listActiveEmailRecipientsFromSupabase,
  listCloseoutsFromSupabase,
  listServersFromSupabase,
  resolveActiveRestaurantIdFromSupabase,
  sendCloseoutEmailFromSupabase,
  updateServerInSupabase,
  upsertCloseoutToSupabase,
} from '../lib/supabaseStore'
import { isSupabaseConfigured } from '../lib/supabase'
import type {
  CloseoutEmailStatus,
  CloseoutRecord,
  EditCloseoutPayload,
  NewCloseoutPayload,
  ServerOption,
} from '../types/closeout'
import { useAuthContext } from './AuthContext'

type SubmissionResult = {
  record: CloseoutRecord
  emailStatus: CloseoutEmailStatus
}

type CloseoutContextValue = {
  activeRestaurantId: string | null
  restaurantError: string | null
  serverOptions: ServerOption[]
  addServerOption: (name: string) => Promise<void>
  updateServerOption: (id: string, name: string) => Promise<void>
  deleteServerOption: (id: string) => Promise<void>
  closeoutHistory: CloseoutRecord[]
  createCloseout: (payload: NewCloseoutPayload) => Promise<SubmissionResult>
  saveDraft: (payload: NewCloseoutPayload, existingDraftId?: string) => Promise<CloseoutRecord>
  saveCloseoutEdit: (id: string, payload: EditCloseoutPayload) => Promise<SubmissionResult | null>
  deleteCloseout: (id: string) => Promise<void>
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
  const { user } = useAuthContext()
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(
    isSupabaseConfigured ? FALLBACK_RESTAURANT_ID : null,
  )
  const [restaurantError, setRestaurantError] = useState<string | null>(null)
  const [serverOptions, setServerOptions] = useState<ServerOption[]>(
    isSupabaseConfigured ? [] : initialServerOptions,
  )
  const [closeoutHistory, setCloseoutHistory] = useState<CloseoutRecord[]>(
    isSupabaseConfigured ? [] : initialCloseoutHistory,
  )
  const draftAutosaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)

  const logActivity = useCallback(
    async (action: string, entityType: string, entityId: string | null, details: string) => {
      if (!isSupabaseConfigured || !activeRestaurantId || !user) return

      try {
        await createActivityLogInSupabase(activeRestaurantId, {
          actorPin: user.pin,
          actorName: user.name,
          actorRole: user.role,
          action,
          entityType,
          entityId,
          details,
        })
      } catch (error) {
        console.error(`Failed to log activity: ${action}.`, error)
      }
    },
    [activeRestaurantId, user],
  )

  const refreshServersFromSupabase = useCallback(async (restaurantId: string) => {
    const remoteServers = await listServersFromSupabase(restaurantId)
    if (remoteServers) {
      setServerOptions(remoteServers)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let isMounted = true

    const loadRemoteData = async () => {
      try {
        const restaurantId = await resolveActiveRestaurantIdFromSupabase()
        console.log('Loaded active restaurant id', restaurantId)

        if (!isMounted) return
        setActiveRestaurantId(restaurantId || FALLBACK_RESTAURANT_ID)
        setRestaurantError(null)

        const [remoteServersResult, remoteCloseoutsResult] = await Promise.allSettled([
          listServersFromSupabase(restaurantId || FALLBACK_RESTAURANT_ID),
          listCloseoutsFromSupabase(restaurantId || FALLBACK_RESTAURANT_ID),
        ])

        if (!isMounted) return

        if (remoteServersResult.status === 'fulfilled') {
          if (remoteServersResult.value) setServerOptions(remoteServersResult.value)
        } else {
          console.error('Failed to load servers from Supabase.', remoteServersResult.reason)
        }

        if (remoteCloseoutsResult.status === 'fulfilled') {
          if (remoteCloseoutsResult.value) setCloseoutHistory(remoteCloseoutsResult.value)
        } else {
          console.error('Failed to load closeouts from Supabase.', remoteCloseoutsResult.reason)
        }
      } catch (error) {
        console.error('Supabase load failed.', error)
        if (!isMounted) return
        setRestaurantError(null)
      }
    }

    void loadRemoteData()

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

    const resolvedRestaurantId = activeRestaurantId ?? (await resolveActiveRestaurantIdFromSupabase())
    const effectiveRestaurantId = resolvedRestaurantId ?? FALLBACK_RESTAURANT_ID
    if (!activeRestaurantId) {
      setActiveRestaurantId(effectiveRestaurantId)
      setRestaurantError(null)
      console.log('Loaded active restaurant id', effectiveRestaurantId)
    }

    try {
      await createServerInSupabase(name, effectiveRestaurantId)
      await refreshServersFromSupabase(effectiveRestaurantId)
      await logActivity('add_server', 'server', null, `Added server ${name}`)
    } catch (error) {
      console.error('Supabase server create failed.', error)
      throw error
    }
  }, [activeRestaurantId, logActivity, refreshServersFromSupabase])

  const updateServerOption = useCallback(async (id: string, name: string) => {
    if (!isSupabaseConfigured) {
      setServerOptions((prev) => prev.map((server) => (server.id === id ? { ...server, name } : server)))
      return
    }

    if (!activeRestaurantId) {
      throw new Error('No restaurant configured.')
    }

    try {
      await updateServerInSupabase(id, name)
      await refreshServersFromSupabase(activeRestaurantId)
    } catch (error) {
      console.error('Supabase server update failed.', error)
      throw error
    }
  }, [activeRestaurantId, refreshServersFromSupabase])

  const deleteServerOption = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) {
      setServerOptions((prev) => prev.filter((server) => server.id !== id))
      return
    }

    if (!activeRestaurantId) {
      throw new Error('No restaurant configured.')
    }

    try {
      await deactivateServerInSupabase(id)
      await refreshServersFromSupabase(activeRestaurantId)
    } catch (error) {
      console.error('Supabase server delete failed.', error)
      throw error
    }
  }, [activeRestaurantId, refreshServersFromSupabase])

  const createCloseout = useCallback(async (payload: NewCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    const nextRecord = buildRecord(createCloseoutId(), payload, timestamp)
    if (payload.status === 'Submitted') {
      nextRecord.submittedAt = timestamp
    }

    if (payload.status === 'Submitted' && isSupabaseConfigured) {
      if (!activeRestaurantId) {
        throw new Error('No restaurant configured.')
      }

      const recipients = await listActiveEmailRecipientsFromSupabase(activeRestaurantId)
      console.log('Loaded active email recipients', recipients ?? [])
      if (!recipients || recipients.length === 0) {
        throw new Error(`No active recipients configured for restaurant ${activeRestaurantId}.`)
      }
    }

    if (isSupabaseConfigured) {
      if (!activeRestaurantId) {
        throw new Error('No restaurant configured.')
      }
      await upsertCloseoutToSupabase(nextRecord, activeRestaurantId)
    }

    setCloseoutHistory((prev) => [nextRecord, ...prev])

    let emailStatus: CloseoutEmailStatus = 'skipped'
    if (payload.status === 'Submitted' && isSupabaseConfigured) {
      try {
        if (!activeRestaurantId) {
          throw new Error('No restaurant configured.')
        }
        emailStatus = await sendCloseoutEmailFromSupabase(nextRecord.id, activeRestaurantId)
      } catch (error) {
        console.error('Failed to send closeout email.', error)
        emailStatus = 'failed'
      }
    }

    if (payload.status === 'Submitted') {
      await logActivity('submit_closeout', 'closeout', null, `Submitted closeout ${nextRecord.id}`)
    }

    return { record: nextRecord, emailStatus }
  }, [activeRestaurantId, logActivity])

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
      if (!activeRestaurantId) {
        throw new Error('No restaurant configured.')
      }
      await upsertCloseoutToSupabase(finalRecord, activeRestaurantId)
    }

    setCloseoutHistory((prev) => {
      const existingIndex = prev.findIndex((record) => record.id === draftId)
      if (existingIndex === -1) return [finalRecord, ...prev]
      return prev.map((record) => (record.id === draftId ? finalRecord : record))
    })

    return finalRecord
  }, [activeRestaurantId, closeoutHistory])

  const saveCloseoutEdit = useCallback(async (id: string, payload: EditCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    const existingRecord = closeoutHistory.find((record) => record.id === id)
    if (!existingRecord) return null

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

    if (payload.status === 'Submitted' && isSupabaseConfigured) {
      if (!activeRestaurantId) {
        throw new Error('No restaurant configured.')
      }

      const recipients = await listActiveEmailRecipientsFromSupabase(activeRestaurantId)
      console.log('Loaded active email recipients', recipients ?? [])
      if (!recipients || recipients.length === 0) {
        throw new Error(`No active recipients configured for restaurant ${activeRestaurantId}.`)
      }
    }

    if (isSupabaseConfigured) {
      if (!activeRestaurantId) {
        throw new Error('No restaurant configured.')
      }
      await upsertCloseoutToSupabase(editedRecord, activeRestaurantId, payload.reason)
    }

    setCloseoutHistory((prev) =>
      prev.map((record) => (record.id === id ? editedRecord : record)),
    )

    let emailStatus: CloseoutEmailStatus = 'skipped'
    const becameSubmitted =
      payload.status === 'Submitted' && existingRecord.status !== 'Submitted'

    if (becameSubmitted && isSupabaseConfigured) {
      try {
        if (!activeRestaurantId) {
          throw new Error('No restaurant configured.')
        }
        emailStatus = await sendCloseoutEmailFromSupabase(editedRecord.id, activeRestaurantId)
      } catch (error) {
        console.error('Failed to send closeout email.', error)
        emailStatus = 'failed'
      }
    }

    if (becameSubmitted) {
      await logActivity('submit_closeout', 'closeout', null, `Submitted closeout ${editedRecord.id}`)
    }

    return { record: editedRecord, emailStatus }
  }, [activeRestaurantId, closeoutHistory, logActivity])

  const deleteCloseout = useCallback(async (id: string) => {
    const target = closeoutHistory.find((record) => record.id === id)
    if (!target) return

    const isSuperAdmin = user?.role === 'super_admin'
    if (target.status === 'Submitted' && !isSuperAdmin) {
      throw new Error('Only Super Admin can delete submitted closeouts.')
    }

    if (isSupabaseConfigured) {
      await deleteCloseoutFromSupabase(id)
    }

    setCloseoutHistory((prev) => prev.filter((record) => record.id !== id))

    await logActivity('delete_closeout', 'closeout', null, `Deleted ${target.status.toLowerCase()} closeout ${id}`)
  }, [closeoutHistory, logActivity, user?.role])

  const registerDraftAutosaveHandler = useCallback((handler: (() => Promise<boolean>) | null) => {
    draftAutosaveHandlerRef.current = handler
  }, [])

  const triggerDraftAutosave = useCallback(async () => {
    if (!draftAutosaveHandlerRef.current) return false
    return draftAutosaveHandlerRef.current()
  }, [])

  const value = useMemo(
    () => ({
      activeRestaurantId,
      restaurantError,
      serverOptions,
      addServerOption,
      updateServerOption,
      deleteServerOption,
      closeoutHistory,
      createCloseout,
      saveDraft,
      saveCloseoutEdit,
      deleteCloseout,
      registerDraftAutosaveHandler,
      triggerDraftAutosave,
    }),
    [
      activeRestaurantId,
      restaurantError,
      serverOptions,
      addServerOption,
      updateServerOption,
      deleteServerOption,
      closeoutHistory,
      createCloseout,
      saveDraft,
      saveCloseoutEdit,
      deleteCloseout,
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
