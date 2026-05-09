import { BadgeDollarSign, HandCoins, ReceiptText, Scale } from 'lucide-react'
import type { PettyCashData, ServerPayoutRow } from '../../types/closeout'
import {
  calculatePettyCashSummary,
  calculateServerTotals,
  getDifferenceColorClass,
} from '../../utils/closeoutCalculations'
import { toCurrency } from '../../utils/currency'
import { Card } from '../ui/Card'
import { StatCard } from '../ui/StatCard'

type TotalsSectionProps = {
  serverRows: ServerPayoutRow[]
  pettyCashData: PettyCashData
}

export const TotalsSection = ({ serverRows, pettyCashData }: TotalsSectionProps) => {
  const serverTotals = calculateServerTotals(serverRows)
  const pettyCashSummary = calculatePettyCashSummary(pettyCashData, serverTotals.serverFinalPay)

  return (
    <Card title="Totals / Cash Summary" subtitle="Live spreadsheet totals and EOD reconciliation values.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Cash Paid In"
          value={toCurrency(serverTotals.cashPaidIn)}
          icon={<HandCoins className="h-4 w-4" />}
        />
        <StatCard
          label="Total Cash Paid Out"
          value={toCurrency(serverTotals.cashPaidOut)}
          icon={<BadgeDollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Total Server Final Pay"
          value={toCurrency(serverTotals.serverFinalPay)}
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="mb-0.5 flex items-center justify-between text-slate-500">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Difference</p>
            <Scale className="h-4 w-4" />
          </div>
          <p className={`text-base font-semibold ${getDifferenceColorClass(pettyCashSummary.difference)}`}>
            {toCurrency(pettyCashSummary.difference)}
          </p>
        </div>
      </div>
    </Card>
  )
}
