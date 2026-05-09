import { useEffect, useMemo, useState } from 'react'
import { Check, Mail, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCloseoutContext } from '../app/CloseoutContext'
import { initialHeaderData, initialPettyCashData } from '../data/mockCloseout'
import type { CloseoutHeaderData, PettyCashData, ServerPayoutRow } from '../types/closeout'
import { CloseoutHeaderSection } from '../components/closeout/CloseoutHeaderSection'
import { PettyCashReconciliation } from '../components/closeout/PettyCashReconciliation'
import { ServerPayoutTable } from '../components/closeout/ServerPayoutTable'
import { TotalsSection } from '../components/closeout/TotalsSection'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SectionTitle } from '../components/ui/SectionTitle'
import {
  calculatePettyCashSummary,
  calculateServerTotals,
  getDifferenceColorClass,
  isEffectivelyZero,
} from '../utils/closeoutCalculations'
import { formatDisplayDate, getCurrentShiftFromLocalTime, getIsoDateToday } from '../utils/date'
import { toCurrency } from '../utils/currency'
import {
  buildInitialRowsForShift,
  createCustomServerRow,
  createStandardServerRow,
  getPrefillServerIdsFromCloseout,
  hasRowData,
  normalizeRowsForShift,
} from '../utils/serverRows'
import type { CloseoutEmailStatus } from '../types/closeout'
import { isSupabaseConfigured } from '../lib/supabase'
import { listActiveEmailRecipientsFromSupabase } from '../lib/supabaseStore'

type FormErrors = Record<string, string>
type HistoryToastState = {
  type: 'success' | 'error'
  message: string
}

const isValidMoney = (value: number) => Number.isFinite(value) && value >= 0

const buildHistoryToastFromEmailStatus = (
  emailStatus: CloseoutEmailStatus,
): HistoryToastState | undefined => {
  if (emailStatus === 'sent') {
    return {
      type: 'success',
      message: 'Closeout submitted and email sent.',
    }
  }

  if (emailStatus === 'failed') {
    return {
      type: 'error',
      message: 'Closeout submitted, but email failed to send.',
    }
  }

  return undefined
}

const getSortTimestamp = (createdAt: string, submittedAt?: string) =>
  new Date(submittedAt ?? createdAt).getTime()

const getLatestSameShiftCloseout = (
  shift: CloseoutHeaderData['shift'],
  records: ReturnType<typeof useCloseoutContext>['closeoutHistory'],
) => {
  const sameShift = records.filter((record) => record.headerData.shift === shift)
  sameShift.sort((a, b) => getSortTimestamp(b.createdAt, b.submittedAt) - getSortTimestamp(a.createdAt, a.submittedAt))
  return sameShift[0]
}

const getLatestCloseoutForCashOnHand = (
  records: ReturnType<typeof useCloseoutContext>['closeoutHistory'],
) => {
  const submittedRecords = records.filter((record) => record.status === 'Submitted')
  const source = submittedRecords.length > 0 ? submittedRecords : records
  if (source.length === 0) return undefined

  const sorted = [...source].sort(
    (a, b) => getSortTimestamp(b.createdAt, b.submittedAt) - getSortTimestamp(a.createdAt, a.submittedAt),
  )
  return sorted[0]
}

const buildInitialState = (closeoutHistory: ReturnType<typeof useCloseoutContext>['closeoutHistory']) => {
  const shift = getCurrentShiftFromLocalTime()
  const latestSameShift = getLatestSameShiftCloseout(shift, closeoutHistory)
  const latestForCashOnHand = getLatestCloseoutForCashOnHand(closeoutHistory)
  const previousFinalCash = latestForCashOnHand?.pettyCashData.actualPhysicalCash ?? 0

  return {
    headerData: {
      ...initialHeaderData,
      businessDate: getIsoDateToday(),
      shift,
    },
    serverRows: buildInitialRowsForShift(shift, getPrefillServerIdsFromCloseout(latestSameShift)),
    pettyCashData: {
      ...initialPettyCashData,
      cashOnHand: previousFinalCash,
      receipts: 0,
      bankWithdrawal: 0,
      actualPhysicalCash: 0,
      comments: '',
    },
  }
}

const serializeDraft = (
  headerData: CloseoutHeaderData,
  serverRows: ServerPayoutRow[],
  pettyCashData: PettyCashData,
) =>
  JSON.stringify({
    headerData,
    serverRows,
    pettyCashData,
  })

export const NewCloseoutPage = () => {
  const navigate = useNavigate()
  const {
    activeRestaurantId,
    closeoutHistory,
    serverOptions,
    createCloseout,
    saveDraft,
    registerDraftAutosaveHandler,
  } = useCloseoutContext()

  const initialState = useMemo(() => buildInitialState(closeoutHistory), [closeoutHistory])

  const [headerData, setHeaderData] = useState<CloseoutHeaderData>(initialState.headerData)
  const [serverRows, setServerRows] = useState<ServerPayoutRow[]>(initialState.serverRows)
  const [pettyCashData, setPettyCashData] = useState<PettyCashData>(initialState.pettyCashData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [lastDraftId, setLastDraftId] = useState<string | undefined>()
  const [syncErrorToast, setSyncErrorToast] = useState('')
  const [recipientEmails, setRecipientEmails] = useState<string[]>([])
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    serializeDraft(initialState.headerData, initialState.serverRows, initialState.pettyCashData),
  )

  const serverTotals = useMemo(() => calculateServerTotals(serverRows), [serverRows])
  const pettyCashSummary = useMemo(
    () => calculatePettyCashSummary(pettyCashData, serverTotals.serverFinalPay),
    [pettyCashData, serverTotals.serverFinalPay],
  )

  const currentSnapshot = useMemo(
    () => serializeDraft(headerData, serverRows, pettyCashData),
    [headerData, serverRows, pettyCashData],
  )

  const completedFields = useMemo(() => {
    let completed = 0
    if (headerData.managerName.trim() && headerData.businessDate.trim()) completed += 1
    if (serverRows.some((row) => hasRowData(row))) completed += 1
    if (Number.isFinite(pettyCashData.actualPhysicalCash)) completed += 1
    if (isEffectivelyZero(pettyCashSummary.difference) || pettyCashData.comments.trim().length > 0) {
      completed += 1
    }
    return completed
  }, [headerData.businessDate, headerData.managerName, pettyCashData, pettyCashSummary.difference, serverRows])

  const validateCloseout = () => {
    const nextErrors: FormErrors = {}

    serverRows.forEach((row, index) => {
      const base = `serverRows.${index}`

      if (row.rowType === 'standard' && row.serverId.trim().length === 0 && hasRowData(row)) {
        nextErrors[`${base}.serverName`] = 'Select a server from Admin Settings list.'
      }

      if (row.rowType === 'custom' && row.customName.trim().length === 0 && hasRowData(row)) {
        nextErrors[`${base}.serverName`] = 'Enter custom server name.'
      }

      if (!isValidMoney(row.cashPaidIn)) {
        nextErrors[`${base}.cashPaidIn`] = 'Enter a valid non-negative number.'
      }
      if (!isValidMoney(row.cashPaidOut)) {
        nextErrors[`${base}.cashPaidOut`] = 'Enter a valid non-negative number.'
      }
      if (!isValidMoney(row.tipShare)) {
        nextErrors[`${base}.tipShare`] = 'Enter a valid non-negative number.'
      }
      if (!isValidMoney(row.runner)) {
        nextErrors[`${base}.runner`] = 'Enter a valid non-negative number.'
      }
    })

    if (!isValidMoney(pettyCashData.cashOnHand)) {
      nextErrors['pettyCash.cashOnHand'] = 'Enter a valid non-negative number.'
    }
    if (!isValidMoney(pettyCashData.receipts)) {
      nextErrors['pettyCash.receipts'] = 'Enter a valid non-negative number.'
    }
    if (!isValidMoney(pettyCashData.bankWithdrawal)) {
      nextErrors['pettyCash.bankWithdrawal'] = 'Enter a valid non-negative number.'
    }

    if (!Number.isFinite(pettyCashData.actualPhysicalCash)) {
      nextErrors['pettyCash.actualPhysicalCash'] = 'Actual Physical Cash is required.'
    } else if (pettyCashData.actualPhysicalCash < 0) {
      nextErrors['pettyCash.actualPhysicalCash'] = 'Enter a valid non-negative number.'
    }

    if (
      !isEffectivelyZero(pettyCashSummary.difference) &&
      pettyCashData.comments.trim().length === 0
    ) {
      nextErrors['pettyCash.comments'] = 'Comments are required when Difference is not zero.'
    }

    return nextErrors
  }

  const scrollToFirstError = (validationErrors: FormErrors) => {
    const firstKey = Object.keys(validationErrors)[0]
    if (!firstKey) return

    window.requestAnimationFrame(() => {
      const element = document.getElementById(firstKey)
      if (!element) return

      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if ('focus' in element) {
        ;(element as HTMLElement).focus()
      }
    })
  }

  const resetErrors = () => {
    if (Object.keys(errors).length > 0) {
      setErrors({})
    }
  }

  useEffect(() => {
    if (!syncErrorToast) return
    const timeoutId = window.setTimeout(() => setSyncErrorToast(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [syncErrorToast])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let isMounted = true

    const loadRecipients = async () => {
      try {
        if (!activeRestaurantId) {
          setRecipientEmails([])
          return
        }

        const recipients = await listActiveEmailRecipientsFromSupabase(activeRestaurantId)
        if (!isMounted) return
        const emails = recipients ?? []
        console.log('Loaded active email recipients', emails)
        setRecipientEmails(emails)
      } catch (error) {
        console.error(`Failed to load active email recipients for restaurant ${activeRestaurantId}.`, error)
        if (!isMounted) return
        setRecipientEmails([])
      }
    }

    void loadRecipients()
    return () => {
      isMounted = false
    }
  }, [activeRestaurantId])

  useEffect(() => {
    registerDraftAutosaveHandler(async () => {
      const hasChanges = currentSnapshot !== lastSavedSnapshot
      if (!hasChanges) return false

      try {
        const savedRecord = await saveDraft(
          {
            headerData,
            serverRows,
            pettyCashData,
            status: 'Draft',
          },
          lastDraftId,
        )

        setLastDraftId(savedRecord.id)
        setLastSavedSnapshot(currentSnapshot)
        return true
      } catch (error) {
        console.error('Draft autosave failed.', error)
        setSyncErrorToast('Could not autosave draft. Check Supabase setup and try again.')
        return false
      }
    })

    return () => registerDraftAutosaveHandler(null)
  }, [
    registerDraftAutosaveHandler,
    currentSnapshot,
    lastSavedSnapshot,
    saveDraft,
    headerData,
    serverRows,
    pettyCashData,
    lastDraftId,
  ])

  const saveDraftAndExit = async () => {
    try {
      const savedRecord = await saveDraft(
        {
          headerData,
          serverRows,
          pettyCashData,
          status: 'Draft',
        },
        lastDraftId,
      )
      setLastDraftId(savedRecord.id)
      setLastSavedSnapshot(currentSnapshot)
      navigate('/closeout-history')
    } catch (error) {
      console.error('Save draft failed.', error)
      setSyncErrorToast('Could not save draft. Check Supabase setup and try again.')
    }
  }

  const submitCloseout = () => {
    if (isSupabaseConfigured && recipientEmails.length === 0) {
      setSyncErrorToast(
        `No active recipients configured for restaurant ${activeRestaurantId ?? 'unknown'}.`,
      )
      return
    }

    const validationErrors = validateCloseout()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      scrollToFirstError(validationErrors)
      return
    }

    setErrors({})
    setIsConfirmModalOpen(true)
  }

  const confirmSubmitCloseout = async () => {
    try {
      if (isSupabaseConfigured && recipientEmails.length === 0) {
        setIsConfirmModalOpen(false)
        setSyncErrorToast(
          `No active recipients configured for restaurant ${activeRestaurantId ?? 'unknown'}.`,
        )
        return
      }

      const result = await createCloseout({
        headerData,
        serverRows,
        pettyCashData,
        status: 'Submitted',
      })

      const historyToast = buildHistoryToastFromEmailStatus(result.emailStatus)
      setIsConfirmModalOpen(false)
      navigate('/closeout-history', {
        state: historyToast ? { closeoutToast: historyToast } : undefined,
      })
    } catch (error) {
      console.error('Submit closeout failed.', error)
      setSyncErrorToast('Could not submit closeout. Check Supabase setup and try again.')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <SectionTitle
          eyebrow="Operations"
          title="New Closeout"
          description="Use this workspace to reconcile server payouts, petty cash activity, and final shift totals before submission."
          actions={
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
              Checklist completed: <span className="font-semibold">{completedFields}/4</span>
            </div>
          }
        />

        <CloseoutHeaderSection
          value={headerData}
          onChange={(next) => {
            const shiftChanged = next.shift !== headerData.shift
            setHeaderData(next)
            setServerRows((prev) => {
              if (!shiftChanged) return prev

              const hasAnyEnteredRows = prev.some((row) => hasRowData(row))
              if (hasAnyEnteredRows) {
                return normalizeRowsForShift(prev, next.shift)
              }

              const latestSameShift = getLatestSameShiftCloseout(next.shift, closeoutHistory)
              return buildInitialRowsForShift(next.shift, getPrefillServerIdsFromCloseout(latestSameShift))
            })
            resetErrors()
          }}
        />

        <TotalsSection serverRows={serverRows} pettyCashData={pettyCashData} />

        <ServerPayoutTable
          rows={serverRows}
          serverOptions={serverOptions}
          onUpdateRows={(next) => {
            setServerRows(next)
            resetErrors()
          }}
          onAddStandardRow={() => {
            setServerRows((prev) => [...prev, createStandardServerRow()])
          }}
          onAddCustomRow={() => {
            setServerRows((prev) => [...prev, createCustomServerRow()])
          }}
          errors={errors}
        />
        <PettyCashReconciliation
          value={pettyCashData}
          totalServerFinalPay={serverTotals.serverFinalPay}
          onChange={(next) => {
            setPettyCashData(next)
            resetErrors()
          }}
          errors={errors}
        />

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => void saveDraftAndExit()}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
          </Button>
          <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={submitCloseout}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Submit Closeout
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isConfirmModalOpen}
        title="Confirm Closeout Submission"
        onClose={() => setIsConfirmModalOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => void confirmSubmitCloseout()}>
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Confirm Submit
            </Button>
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Shift Type</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{headerData.shift}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Date</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDisplayDate(headerData.businessDate)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Closeout Totals</h4>
          <div className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
            <p>Total Cash Paid In: <span className="font-semibold text-slate-900">{toCurrency(serverTotals.cashPaidIn)}</span></p>
            <p>Total Cash Paid Out: <span className="font-semibold text-slate-900">{toCurrency(serverTotals.cashPaidOut)}</span></p>
            <p>Total Tip Share: <span className="font-semibold text-slate-900">{toCurrency(serverTotals.tipShare)}</span></p>
            <p>Total Runner: <span className="font-semibold text-slate-900">{toCurrency(serverTotals.runner)}</span></p>
            <p>Total Server Final Pay: <span className="font-semibold text-slate-900">{toCurrency(serverTotals.serverFinalPay)}</span></p>
            <p>Difference: <span className={`font-semibold ${getDifferenceColorClass(pettyCashSummary.difference)}`}>{toCurrency(pettyCashSummary.difference)}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Comments</h4>
          <p className="mt-1.5 text-sm text-slate-700">
            {pettyCashData.comments.trim().length > 0 ? pettyCashData.comments : 'No comments provided.'}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Email Preview</h4>
          <div className="mt-2 space-y-1 text-sm text-amber-900">
            <p>
              <span className="font-semibold">To:</span>{' '}
              {recipientEmails.length > 0
                ? recipientEmails.join(', ')
                : 'No active recipients configured'}
            </p>
            <p><span className="font-semibold">Subject:</span> {headerData.shift} Closeout - {formatDisplayDate(headerData.businessDate)}</p>
            <p className="pt-1">
              This email will include the closeout totals, variance details, and comments shown above.
            </p>
          </div>
        </div>
      </Modal>

      {syncErrorToast && (
        <div className="fixed bottom-5 right-6 z-[60] rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-red-700/35">
          {syncErrorToast}
        </div>
      )}
    </>
  )
}
