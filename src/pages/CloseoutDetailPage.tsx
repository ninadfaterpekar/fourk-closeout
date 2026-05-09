import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Mail, Pencil, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCloseoutContext } from '../app/CloseoutContext'
import { CloseoutHeaderSection } from '../components/closeout/CloseoutHeaderSection'
import { PettyCashReconciliation } from '../components/closeout/PettyCashReconciliation'
import { ServerPayoutTable } from '../components/closeout/ServerPayoutTable'
import { TotalsSection } from '../components/closeout/TotalsSection'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { SectionTitle } from '../components/ui/SectionTitle'
import type { CloseoutHeaderData, PettyCashData, ServerPayoutRow } from '../types/closeout'
import {
  calculatePettyCashSummary,
  calculateServerTotals,
  getDifferenceColorClass,
  isEffectivelyZero,
} from '../utils/closeoutCalculations'
import {
  createCustomServerRow,
  createStandardServerRow,
  hasRowData,
  normalizeRowsForShift,
} from '../utils/serverRows'
import { formatDateTimeShort, formatDisplayDate, getDayOfWeek } from '../utils/date'
import { toCurrency } from '../utils/currency'

type FormErrors = Record<string, string>

const isValidMoney = (value: number) => Number.isFinite(value) && value >= 0

const resolveServerName = (row: ServerPayoutRow, serverLookup: Map<string, string>) => {
  if (row.rowType === 'custom') return row.customName || 'Custom Server'
  return serverLookup.get(row.serverId) ?? 'Unknown Server'
}

export const CloseoutDetailPage = () => {
  const navigate = useNavigate()
  const { closeoutId } = useParams<{ closeoutId: string }>()
  const { closeoutHistory, serverOptions, saveCloseoutEdit } = useCloseoutContext()

  const record = closeoutHistory.find((item) => item.id === closeoutId)

  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [syncErrorToast, setSyncErrorToast] = useState('')
  const [headerData, setHeaderData] = useState<CloseoutHeaderData>(record?.headerData ?? {
    businessDate: '',
    shift: 'Lunch',
    managerName: '',
    backroomParty: 'No',
  })
  const [serverRows, setServerRows] = useState<ServerPayoutRow[]>(record?.serverRows ?? [])
  const [pettyCashData, setPettyCashData] = useState<PettyCashData>(record?.pettyCashData ?? {
    cashOnHand: 0,
    receipts: 0,
    bankWithdrawal: 0,
    actualPhysicalCash: 0,
    comments: '',
  })

  const serverLookup = useMemo(
    () => new Map(serverOptions.map((server) => [server.id, server.name])),
    [serverOptions],
  )

  const serverTotals = useMemo(() => calculateServerTotals(serverRows), [serverRows])
  const pettyCashSummary = useMemo(
    () => calculatePettyCashSummary(pettyCashData, serverTotals.serverFinalPay),
    [pettyCashData, serverTotals.serverFinalPay],
  )

  const showSyncError = (message: string, error: unknown) => {
    console.error(message, error)
    setSyncErrorToast('Could not save to Supabase. Please try again.')
  }

  useEffect(() => {
    if (!syncErrorToast) return
    const timeoutId = window.setTimeout(() => setSyncErrorToast(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [syncErrorToast])

  if (!record) {
    return (
      <Card title="Closeout Not Found">
        <p className="text-sm text-slate-600">This closeout record does not exist.</p>
        <div className="mt-3">
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => navigate('/closeout-history')}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to History
          </Button>
        </div>
      </Card>
    )
  }

  const startEditing = () => {
    setHeaderData(record.headerData)
    setServerRows(record.serverRows)
    setPettyCashData(record.pettyCashData)
    setEditReason('')
    setErrors({})
    setIsEditing(true)
  }

  const validateEditReasonOnly = () => {
    const nextErrors: FormErrors = {}
    if (editReason.trim().length === 0) {
      nextErrors.editReason = 'Edit comment (change reason) is required before saving.'
    }
    return nextErrors
  }

  const validateForSubmit = () => {
    const nextErrors = validateEditReasonOnly()

    serverRows.forEach((row, index) => {
      const base = `serverRows.${index}`

      if (row.rowType === 'standard' && row.serverId.trim().length === 0 && hasRowData(row)) {
        nextErrors[`${base}.serverName`] = 'Select a server from Admin Settings list.'
      }

      if (row.rowType === 'custom' && row.customName.trim().length === 0 && hasRowData(row)) {
        nextErrors[`${base}.serverName`] = 'Enter custom server name.'
      }

      if (!isValidMoney(row.cashPaidIn)) nextErrors[`${base}.cashPaidIn`] = 'Enter a valid non-negative number.'
      if (!isValidMoney(row.cashPaidOut)) nextErrors[`${base}.cashPaidOut`] = 'Enter a valid non-negative number.'
      if (!isValidMoney(row.tipShare)) nextErrors[`${base}.tipShare`] = 'Enter a valid non-negative number.'
      if (!isValidMoney(row.runner)) nextErrors[`${base}.runner`] = 'Enter a valid non-negative number.'
    })

    if (!isValidMoney(pettyCashData.cashOnHand)) nextErrors['pettyCash.cashOnHand'] = 'Enter a valid non-negative number.'
    if (!isValidMoney(pettyCashData.receipts)) nextErrors['pettyCash.receipts'] = 'Enter a valid non-negative number.'
    if (!isValidMoney(pettyCashData.bankWithdrawal)) nextErrors['pettyCash.bankWithdrawal'] = 'Enter a valid non-negative number.'

    if (!Number.isFinite(pettyCashData.actualPhysicalCash)) {
      nextErrors['pettyCash.actualPhysicalCash'] = 'Actual Physical Cash is required.'
    } else if (pettyCashData.actualPhysicalCash < 0) {
      nextErrors['pettyCash.actualPhysicalCash'] = 'Enter a valid non-negative number.'
    }

    if (!isEffectivelyZero(pettyCashSummary.difference) && pettyCashData.comments.trim().length === 0) {
      nextErrors['pettyCash.comments'] = 'Comments are required when Difference is not zero.'
    }

    return nextErrors
  }

  const saveEditsForSubmitted = async () => {
    const nextErrors = validateForSubmit()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    try {
      await saveCloseoutEdit(record.id, {
        headerData,
        serverRows,
        pettyCashData,
        status: record.status,
        reason: editReason,
      })

      setIsEditing(false)
      setErrors({})
      setEditReason('')
    } catch (error) {
      showSyncError('Failed to save submitted closeout edits.', error)
    }
  }

  const saveDraftEdits = async () => {
    const nextErrors = validateEditReasonOnly()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    try {
      await saveCloseoutEdit(record.id, {
        headerData,
        serverRows,
        pettyCashData,
        status: 'Draft',
        reason: editReason,
      })

      setIsEditing(false)
      setErrors({})
      setEditReason('')
      navigate('/closeout-history')
    } catch (error) {
      showSyncError('Failed to save draft edits.', error)
    }
  }

  const requestDraftSubmit = () => {
    const nextErrors = validateForSubmit()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setIsSubmitConfirmOpen(true)
  }

  const confirmDraftSubmit = async () => {
    try {
      await saveCloseoutEdit(record.id, {
        headerData,
        serverRows,
        pettyCashData,
        status: 'Submitted',
        reason: editReason,
      })

      setIsSubmitConfirmOpen(false)
      setIsEditing(false)
      navigate('/closeout-history')
    } catch (error) {
      showSyncError('Failed to submit draft closeout.', error)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <SectionTitle
          eyebrow="Records"
          title={`Closeout ${record.id}`}
          description={`Created ${formatDateTimeShort(record.createdAt)}${record.submittedAt ? ` • Submitted ${formatDateTimeShort(record.submittedAt)}` : ''}`}
          actions={
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => navigate('/closeout-history')}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
              {!isEditing && (
                <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={startEditing}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
          }
        />

        {isEditing ? (
          <>
            <CloseoutHeaderSection
              value={headerData}
              onChange={(next) => {
                setHeaderData(next)
                setServerRows((prev) =>
                  next.shift !== headerData.shift ? normalizeRowsForShift(prev, next.shift) : prev,
                )
              }}
            />
            <TotalsSection serverRows={serverRows} pettyCashData={pettyCashData} />
            <ServerPayoutTable
              rows={serverRows}
              serverOptions={serverOptions}
              onUpdateRows={setServerRows}
              onAddStandardRow={() => setServerRows((prev) => [...prev, createStandardServerRow()])}
              onAddCustomRow={() => setServerRows((prev) => [...prev, createCustomServerRow()])}
              errors={errors}
            />
            <PettyCashReconciliation
              value={pettyCashData}
              totalServerFinalPay={serverTotals.serverFinalPay}
              onChange={setPettyCashData}
              errors={errors}
            />

            <Card title="Edit Comment" subtitle="Required before saving changes to this closeout.">
              <textarea
                id="editReason"
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                rows={3}
                placeholder="Explain what changed and why"
                className={`w-full resize-y rounded-md border px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                  errors.editReason
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
                }`}
              />
              {errors.editReason && <p className="mt-1 text-xs font-medium text-red-600">{errors.editReason}</p>}

              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>

                {record.status === 'Draft' ? (
                  <>
                    <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => void saveDraftEdits()}>
                      <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
                    </Button>
                    <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={requestDraftSubmit}>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Submit Closeout
                    </Button>
                  </>
                ) : (
                    <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => void saveEditsForSubmitted()}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Save Edits
                  </Button>
                )}
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card title="Header">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 text-sm">
                <div><p className="text-[11px] uppercase text-slate-500">Date</p><p className="font-semibold text-slate-900">{formatDisplayDate(record.headerData.businessDate)}</p></div>
                <div><p className="text-[11px] uppercase text-slate-500">Day of Week</p><p className="font-semibold text-slate-900">{getDayOfWeek(record.headerData.businessDate)}</p></div>
                <div><p className="text-[11px] uppercase text-slate-500">Shift</p><p className="font-semibold text-slate-900">{record.headerData.shift}</p></div>
                <div><p className="text-[11px] uppercase text-slate-500">Manager on Duty</p><p className="font-semibold text-slate-900">{record.headerData.managerName}</p></div>
                <div><p className="text-[11px] uppercase text-slate-500">Backroom Party</p><p className="font-semibold text-slate-900">{record.headerData.backroomParty}</p></div>
                <div><p className="text-[11px] uppercase text-slate-500">Status</p><p className="font-semibold text-slate-900">{record.status}</p></div>
              </div>
            </Card>

            <TotalsSection serverRows={record.serverRows} pettyCashData={record.pettyCashData} />

            <Card title="Server Payout">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      <th className="pb-2 pr-2">Server Name</th>
                      <th className="pb-2 px-2">Cash Paid In</th>
                      <th className="pb-2 px-2">Cash Paid Out</th>
                      <th className="pb-2 px-2">Tip Share</th>
                      <th className="pb-2 px-2">Runner</th>
                      <th className="pb-2 px-2">Server Final Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.serverRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 text-sm">
                        <td className="py-2 pr-2 text-slate-800">{resolveServerName(row, serverLookup)}</td>
                        <td className="py-2 px-2 text-slate-700">{toCurrency(row.cashPaidIn)}</td>
                        <td className="py-2 px-2 text-slate-700">{toCurrency(row.cashPaidOut)}</td>
                        <td className="py-2 px-2 text-slate-700">{toCurrency(row.tipShare)}</td>
                        <td className="py-2 px-2 text-slate-700">{toCurrency(row.runner)}</td>
                        <td className="py-2 px-2 font-semibold text-slate-900">
                          {toCurrency(row.cashPaidOut - row.tipShare - row.runner - row.cashPaidIn)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Petty Cash Reconciliation">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Cash on Hand</p><p className="font-semibold text-slate-900">{toCurrency(record.pettyCashData.cashOnHand)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Receipts</p><p className="font-semibold text-slate-900">{toCurrency(record.pettyCashData.receipts)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Daily Total</p><p className="font-semibold text-slate-900">{toCurrency(pettyCashSummary.dailyTotal)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Bank Withdrawal</p><p className="font-semibold text-slate-900">{toCurrency(record.pettyCashData.bankWithdrawal)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Before Payout Cash</p><p className="font-semibold text-slate-900">{toCurrency(pettyCashSummary.beforePayoutCash)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Ideal EOD Physical Cash</p><p className="font-semibold text-slate-900">{toCurrency(pettyCashSummary.idealEodPhysicalCash)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Actual Physical Cash</p><p className="font-semibold text-slate-900">{toCurrency(record.pettyCashData.actualPhysicalCash)}</p></div>
                <div className="rounded-lg border border-slate-200 p-2.5"><p className="text-[11px] uppercase text-slate-500">Difference</p><p className={`font-semibold ${getDifferenceColorClass(pettyCashSummary.difference)}`}>{toCurrency(pettyCashSummary.difference)}</p></div>
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 p-2.5 text-sm">
                <p className="text-[11px] uppercase text-slate-500">Comments</p>
                <p className="text-slate-800">{record.pettyCashData.comments || 'No comments provided.'}</p>
              </div>
            </Card>

            <Card title="Change Notes" subtitle="Edit history for this closeout record.">
              <div className="space-y-2">
                {record.editHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">No edit history yet.</p>
                ) : (
                  record.editHistory.map((note) => (
                    <div key={note.id} className="rounded-lg border border-slate-200 p-2.5">
                      <p className="text-xs font-semibold text-slate-500">{formatDateTimeShort(note.timestamp)}</p>
                      <p className="text-sm text-slate-800">{note.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      <Modal
        isOpen={isSubmitConfirmOpen}
        title="Confirm Closeout Submission"
        onClose={() => setIsSubmitConfirmOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setIsSubmitConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => void confirmDraftSubmit()}>
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Confirm Submit
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">Submitting this draft will mark it as Submitted and return to Closeout History.</p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Date</p>
            <p className="font-semibold text-slate-900">{formatDisplayDate(headerData.businessDate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Shift</p>
            <p className="font-semibold text-slate-900">{headerData.shift}</p>
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
