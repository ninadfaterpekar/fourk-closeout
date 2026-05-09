import { Plus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { ServerOption, ServerPayoutRow } from '../../types/closeout'
import { calculateServerFinalPay, calculateServerTotals } from '../../utils/closeoutCalculations'
import { toCurrency } from '../../utils/currency'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { CurrencyInput } from '../ui/CurrencyInput'

type ServerPayoutTableProps = {
  rows: ServerPayoutRow[]
  serverOptions: ServerOption[]
  onUpdateRows: (rows: ServerPayoutRow[]) => void
  onAddStandardRow: () => void
  onAddCustomRow: () => void
  errors?: Record<string, string>
}

export const ServerPayoutTable = ({
  rows,
  serverOptions,
  onUpdateRows,
  onAddStandardRow,
  onAddCustomRow,
  errors = {},
}: ServerPayoutTableProps) => {
  const [addServerError, setAddServerError] = useState('')

  const updateRow = <K extends keyof ServerPayoutRow>(index: number, key: K, value: ServerPayoutRow[K]) => {
    const updatedRows = [...rows]
    updatedRows[index] = { ...updatedRows[index], [key]: value }
    onUpdateRows(updatedRows)
    if (
      addServerError &&
      ((key === 'serverId' && typeof value === 'string' && value.trim().length > 0) ||
        (key === 'customName' && typeof value === 'string' && value.trim().length > 0))
    ) {
      setAddServerError('')
    }
  }

  const removeRow = (id: string) => {
    onUpdateRows(rows.filter((row) => row.id !== id))
  }

  const totals = calculateServerTotals(rows)

  const isRowNameBlank = (row: ServerPayoutRow) => {
    if (row.rowType === 'standard') return row.serverId.trim().length === 0
    return row.customName.trim().length === 0
  }

  const getLastRowByType = (rowType: ServerPayoutRow['rowType']) => {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (rows[index].rowType === rowType) return rows[index]
    }
    return undefined
  }

  const handleAddStandardRow = () => {
    const lastStandard = getLastRowByType('standard')
    if (lastStandard && isRowNameBlank(lastStandard)) {
      setAddServerError('Enter a server name before adding.')
      return
    }
    setAddServerError('')
    onAddStandardRow()
  }

  const handleAddCustomRow = () => {
    const lastCustom = getLastRowByType('custom')
    if (lastCustom && isRowNameBlank(lastCustom)) {
      setAddServerError('Enter a server name before adding.')
      return
    }
    setAddServerError('')
    onAddCustomRow()
  }

  return (
    <Card
      title="Server Payout"
      subtitle="Final pay formula: Cash Paid Out - Tip Share - Runner - Cash Paid In"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="pb-2 pr-2 font-semibold">Server Name</th>
              <th className="pb-2 px-2 font-semibold">Cash Paid In</th>
              <th className="pb-2 px-2 font-semibold">Cash Paid Out</th>
              <th className="pb-2 px-2 font-semibold">Tip Share</th>
              <th className="pb-2 px-2 font-semibold">Runner</th>
              <th className="pb-2 px-2 font-semibold">Server Final Pay</th>
              <th className="pb-2 pl-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const serverFinalPay = calculateServerFinalPay(row)

              return (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    {row.rowType === 'standard' ? (
                      <select
                        id={`serverRows.${index}.serverName`}
                        value={row.serverId}
                        onChange={(event) => updateRow(index, 'serverId', event.target.value)}
                        className={`w-44 rounded-md border px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                          errors[`serverRows.${index}.serverName`]
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
                        }`}
                      >
                        <option value="">Select server</option>
                        {serverOptions.map((server) => (
                          <option key={server.id} value={server.id}>
                            {server.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`serverRows.${index}.serverName`}
                        type="text"
                        value={row.customName}
                        onChange={(event) => updateRow(index, 'customName', event.target.value)}
                        placeholder="Custom server name"
                        className={`w-44 rounded-md border px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                          errors[`serverRows.${index}.serverName`]
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
                        }`}
                      />
                    )}
                    {errors[`serverRows.${index}.serverName`] && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {errors[`serverRows.${index}.serverName`]}
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <CurrencyInput
                      inputId={`serverRows.${index}.cashPaidIn`}
                      value={row.cashPaidIn}
                      onChange={(value) => updateRow(index, 'cashPaidIn', value)}
                      error={errors[`serverRows.${index}.cashPaidIn`]}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <CurrencyInput
                      inputId={`serverRows.${index}.cashPaidOut`}
                      value={row.cashPaidOut}
                      onChange={(value) => updateRow(index, 'cashPaidOut', value)}
                      error={errors[`serverRows.${index}.cashPaidOut`]}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <CurrencyInput
                      inputId={`serverRows.${index}.tipShare`}
                      value={row.tipShare}
                      onChange={(value) => updateRow(index, 'tipShare', value)}
                      error={errors[`serverRows.${index}.tipShare`]}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <CurrencyInput
                      inputId={`serverRows.${index}.runner`}
                      value={row.runner}
                      onChange={(value) => updateRow(index, 'runner', value)}
                      error={errors[`serverRows.${index}.runner`]}
                    />
                  </td>
                  <td className="px-2 py-3 text-sm font-semibold text-slate-900">
                    {toCurrency(serverFinalPay)}
                  </td>
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove server row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 text-sm font-semibold text-slate-900">
              <td className="rounded-l-lg py-2 pr-2">Totals</td>
              <td className="py-2 px-2">{toCurrency(totals.cashPaidIn)}</td>
              <td className="py-2 px-2">{toCurrency(totals.cashPaidOut)}</td>
              <td className="py-2 px-2">{toCurrency(totals.tipShare)}</td>
              <td className="py-2 px-2">{toCurrency(totals.runner)}</td>
              <td className="py-2 px-2">{toCurrency(totals.serverFinalPay)}</td>
              <td className="rounded-r-lg py-2 pl-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={handleAddStandardRow}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Server Row
          </Button>
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={handleAddCustomRow}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Custom Server
          </Button>
        </div>
        <p className="text-xs text-slate-600">
          Total server final pay: <span className="font-semibold text-slate-900">{toCurrency(totals.serverFinalPay)}</span>
        </p>
      </div>
      {addServerError && <p className="mt-1 text-xs font-medium text-red-600">{addServerError}</p>}
    </Card>
  )
}
