import type { PettyCashData } from '../../types/closeout'
import {
  calculatePettyCashSummary,
  getDifferenceColorClass,
} from '../../utils/closeoutCalculations'
import { toCurrency } from '../../utils/currency'
import { Card } from '../ui/Card'
import { CurrencyInput } from '../ui/CurrencyInput'

type PettyCashReconciliationProps = {
  value: PettyCashData
  totalServerFinalPay: number
  onChange: (value: PettyCashData) => void
  errors?: Record<string, string>
}

export const PettyCashReconciliation = ({
  value,
  totalServerFinalPay,
  onChange,
  errors = {},
}: PettyCashReconciliationProps) => {
  const summary = calculatePettyCashSummary(value, totalServerFinalPay)

  const update = <K extends keyof PettyCashData>(key: K, nextValue: PettyCashData[K]) => {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <Card title="Petty Cash Reconciliation" subtitle="Spreadsheet formulas are applied exactly as entered.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 rounded-xl border border-slate-200 p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Cash on Hand</span>
          <CurrencyInput
            inputId="pettyCash.cashOnHand"
            value={value.cashOnHand}
            onChange={(next) => update('cashOnHand', next)}
            error={errors['pettyCash.cashOnHand']}
          />
        </label>

        <label className="space-y-1 rounded-xl border border-slate-200 p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Receipts</span>
          <CurrencyInput
            inputId="pettyCash.receipts"
            value={value.receipts}
            onChange={(next) => update('receipts', next)}
            error={errors['pettyCash.receipts']}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Daily Total</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{toCurrency(summary.dailyTotal)}</p>
        </div>

        <label className="space-y-1 rounded-xl border border-slate-200 p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Bank Withdrawal</span>
          <CurrencyInput
            inputId="pettyCash.bankWithdrawal"
            value={value.bankWithdrawal}
            onChange={(next) => update('bankWithdrawal', next)}
            error={errors['pettyCash.bankWithdrawal']}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Before Payout Cash</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{toCurrency(summary.beforePayoutCash)}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Ideal EOD Physical Cash</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{toCurrency(summary.idealEodPhysicalCash)}</p>
        </div>

        <label className="space-y-1 rounded-xl border border-slate-200 p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Actual Physical Cash</span>
          <CurrencyInput
            inputId="pettyCash.actualPhysicalCash"
            value={value.actualPhysicalCash}
            onChange={(next) => update('actualPhysicalCash', next)}
            error={errors['pettyCash.actualPhysicalCash']}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Difference</p>
          <p className={`mt-1 text-base font-semibold ${getDifferenceColorClass(summary.difference)}`}>
            {toCurrency(summary.difference)}
          </p>
        </div>
      </div>

      <label className="mt-2 block space-y-1 rounded-xl border border-slate-200 p-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Comments</span>
        <textarea
          id="pettyCash.comments"
          value={value.comments}
          onChange={(event) => update('comments', event.target.value)}
          rows={2}
          placeholder="Add notes for over/short, receipt gaps, or manager remarks"
          className={`w-full resize-y rounded-md border px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
            errors['pettyCash.comments']
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
          }`}
        />
        {errors['pettyCash.comments'] && (
          <p className="text-xs font-medium text-red-600">{errors['pettyCash.comments']}</p>
        )}
      </label>
    </Card>
  )
}
