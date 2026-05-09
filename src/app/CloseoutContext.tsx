/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { initialCloseoutHistory, initialServerOptions } from '../data/mockCloseout'
import type {
  CloseoutRecord,
  EditCloseoutPayload,
  NewCloseoutPayload,
  ServerOption,
} from '../types/closeout'

type CloseoutContextValue = {
  serverOptions: ServerOption[]
  addServerOption: (name: string) => void
  updateServerOption: (id: string, name: string) => void
  deleteServerOption: (id: string) => void
  closeoutHistory: CloseoutRecord[]
  createCloseout: (payload: NewCloseoutPayload) => CloseoutRecord
  saveDraft: (payload: NewCloseoutPayload, existingDraftId?: string) => CloseoutRecord
  saveCloseoutEdit: (id: string, payload: EditCloseoutPayload) => void
  registerDraftAutosaveHandler: (handler: (() => boolean) | null) => void
  triggerDraftAutosave: () => boolean
}

const CloseoutContext = createContext<CloseoutContextValue | null>(null)

const cloneServerRows = (rows: NewCloseoutPayload['serverRows']) => rows.map((row) => ({ ...row }))
const clonePettyCash = (pettyCashData: NewCloseoutPayload['pettyCashData']) => ({ ...pettyCashData })
const cloneHeader = (headerData: NewCloseoutPayload['headerData']) => ({ ...headerData })

const createCloseoutId = () => `CO-${String(Date.now()).slice(-6)}`

export const CloseoutProvider = ({ children }: { children: ReactNode }) => {
  const [serverOptions, setServerOptions] = useState<ServerOption[]>(initialServerOptions)
  const [closeoutHistory, setCloseoutHistory] = useState<CloseoutRecord[]>(initialCloseoutHistory)
  const draftAutosaveHandlerRef = useRef<(() => boolean) | null>(null)

  const addServerOption = useCallback((name: string) => {
    setServerOptions((prev) => [...prev, { id: `srv-${crypto.randomUUID()}`, name }])
  }, [])

  const updateServerOption = useCallback((id: string, name: string) => {
    setServerOptions((prev) => prev.map((server) => (server.id === id ? { ...server, name } : server)))
  }, [])

  const deleteServerOption = useCallback((id: string) => {
    setServerOptions((prev) => prev.filter((server) => server.id !== id))
  }, [])

  const createCloseout = useCallback((payload: NewCloseoutPayload) => {
    const timestamp = new Date().toISOString()
    const nextRecord: CloseoutRecord = {
      id: createCloseoutId(),
      headerData: cloneHeader(payload.headerData),
      serverRows: cloneServerRows(payload.serverRows),
      pettyCashData: clonePettyCash(payload.pettyCashData),
      status: payload.status,
      createdAt: timestamp,
      submittedAt: payload.status === 'Submitted' ? timestamp : undefined,
      editHistory: [],
    }

    setCloseoutHistory((prev) => [nextRecord, ...prev])
    return nextRecord
  }, [])

  const saveDraft = useCallback((payload: NewCloseoutPayload, existingDraftId?: string) => {
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
          createdAt: record.createdAt || timestamp,
        }
        return updatedRecord
      }),
    )

    if (updatedRecord) return updatedRecord

    return createCloseout({ ...payload, status: 'Draft' })
  }, [createCloseout])

  const saveCloseoutEdit = useCallback((id: string, payload: EditCloseoutPayload) => {
    const timestamp = new Date().toISOString()

    setCloseoutHistory((prev) =>
      prev.map((record) => {
        if (record.id !== id) return record

        return {
          ...record,
          headerData: cloneHeader(payload.headerData),
          serverRows: cloneServerRows(payload.serverRows),
          pettyCashData: clonePettyCash(payload.pettyCashData),
          status: payload.status,
          submittedAt:
            payload.status === 'Submitted'
              ? record.submittedAt ?? timestamp
              : record.submittedAt,
          editHistory: [
            {
              id: `note-${crypto.randomUUID()}`,
              timestamp,
              reason: payload.reason,
            },
            ...record.editHistory,
          ],
        }
      }),
    )
  }, [])

  const registerDraftAutosaveHandler = useCallback((handler: (() => boolean) | null) => {
    draftAutosaveHandlerRef.current = handler
  }, [])

  const triggerDraftAutosave = useCallback(() => {
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
