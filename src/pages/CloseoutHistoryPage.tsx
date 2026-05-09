import { ArrowDownUp, BanknoteArrowDown, CalendarDays, HandCoins, Plus, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCloseoutContext } from '../app/CloseoutContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SectionTitle } from '../components/ui/SectionTitle'
import { StatCard } from '../components/ui/StatCard'
import { formatDisplayDate, getIsoDateToday, getWeekBounds, isDateWithinBounds } from '../utils/date'
import { getDifferenceColorClass } from '../utils/closeoutCalculations'
import {
  getCloseoutDifference,
  getCloseoutServerTotals,
  getCloseoutSortTimestamp,
  getShiftRank,
} from '../utils/closeoutRecord'
import { toCurrency } from '../utils/currency'

type SortField = 'date' | 'shift'
type SortDirection = 'asc' | 'desc'

const truncateComment = (value: string) => (value.length > 80 ? `${value.slice(0, 80)}...` : value)

export const CloseoutHistoryPage = () => {
  const navigate = useNavigate()
  const { closeoutHistory } = useCloseoutContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [weekReferenceDate, setWeekReferenceDate] = useState(getIsoDateToday())

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortField(field)
    setSortDirection(field === 'date' ? 'desc' : 'asc')
  }

  const visibleRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = closeoutHistory.filter((record) => {
      if (!normalizedSearch) return true

      const serverTotals = getCloseoutServerTotals(record)
      const difference = getCloseoutDifference(record)

      const haystack = [
        record.headerData.businessDate,
        formatDisplayDate(record.headerData.businessDate),
        record.headerData.shift,
        record.headerData.managerName,
        record.status,
        record.pettyCashData.comments,
        difference.toString(),
        toCurrency(difference),
        toCurrency(serverTotals.serverFinalPay),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })

    return [...filtered].sort((a, b) => {
      if (sortField === 'date') {
        const aSort = getCloseoutSortTimestamp(a)
        const bSort = getCloseoutSortTimestamp(b)

        const businessDateDelta = aSort.businessDateMs - bSort.businessDateMs
        if (businessDateDelta !== 0) {
          return sortDirection === 'asc' ? businessDateDelta : -businessDateDelta
        }

        const submittedDelta = aSort.submittedMs - bSort.submittedMs
        return sortDirection === 'asc' ? submittedDelta : -submittedDelta
      }

      const shiftDelta = getShiftRank(a.headerData.shift) - getShiftRank(b.headerData.shift)
      if (shiftDelta !== 0) {
        return sortDirection === 'asc' ? shiftDelta : -shiftDelta
      }

      const aSort = getCloseoutSortTimestamp(a)
      const bSort = getCloseoutSortTimestamp(b)
      return bSort.businessDateMs - aSort.businessDateMs
    })
  }, [closeoutHistory, searchTerm, sortField, sortDirection])

  const weeklySummary = useMemo(() => {
    const { start, end } = getWeekBounds(weekReferenceDate)
    const weekRows = closeoutHistory.filter((record) =>
      isDateWithinBounds(record.headerData.businessDate, start, end),
    )

    const weeklyBankWithdrawn = weekRows.reduce((sum, record) => sum + record.pettyCashData.bankWithdrawal, 0)
    const weeklyPayout = weekRows.reduce(
      (sum, record) => sum + getCloseoutServerTotals(record).serverFinalPay,
      0,
    )
    const highestDailyPayout = weekRows.reduce(
      (max, record) => Math.max(max, getCloseoutServerTotals(record).serverFinalPay),
      0,
    )
    const totalWeeklyDifference = weekRows.reduce((sum, record) => sum + getCloseoutDifference(record), 0)

    return {
      start,
      end,
      weeklyBankWithdrawn,
      weeklyPayout,
      highestDailyPayout,
      totalWeeklyDifference,
    }
  }, [closeoutHistory, weekReferenceDate])

  return (
    <div className="space-y-4">
      <SectionTitle
        eyebrow="Records"
        title="Closeout History"
        description="Review closeouts, investigate variances, and open records for detail and edits."
        actions={
          <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => navigate('/new-closeout')}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Closeout
          </Button>
        }
      />

      <Card title="Weekly Summary" subtitle={`Week ${formatDisplayDate(weeklySummary.start)} - ${formatDisplayDate(weeklySummary.end)}`}>
        <div className="mb-3 max-w-[220px]">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Reference Date</span>
            <input
              type="date"
              value={weekReferenceDate}
              onChange={(event) => setWeekReferenceDate(event.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Weekly Bank Withdrawn" value={toCurrency(weeklySummary.weeklyBankWithdrawn)} icon={<BanknoteArrowDown className="h-4 w-4" />} />
          <StatCard label="Weekly Payout" value={toCurrency(weeklySummary.weeklyPayout)} icon={<HandCoins className="h-4 w-4" />} />
          <StatCard label="Highest Daily Payout" value={toCurrency(weeklySummary.highestDailyPayout)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Total Weekly Difference" value={toCurrency(weeklySummary.totalWeeklyDifference)} icon={<CalendarDays className="h-4 w-4" />} />
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search date, shift, manager, status, comments, difference"
            className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="pb-2 pr-2 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('date')}
                    className="inline-flex items-center gap-1 font-semibold"
                  >
                    Date
                    <ArrowDownUp className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="pb-2 px-2 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('shift')}
                    className="inline-flex items-center gap-1 font-semibold"
                  >
                    Shift
                    <ArrowDownUp className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="pb-2 px-2 font-semibold">Manager</th>
                <th className="pb-2 px-2 font-semibold">Final Pay</th>
                <th className="pb-2 px-2 font-semibold">Final Cash</th>
                <th className="pb-2 px-2 font-semibold">Difference</th>
                <th className="pb-2 px-2 font-semibold">Comments</th>
                <th className="pb-2 pl-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const serverTotals = getCloseoutServerTotals(row)
                const difference = getCloseoutDifference(row)

                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-slate-100 text-sm transition hover:bg-slate-50"
                    onClick={() => navigate(`/closeout-history/${row.id}`)}
                  >
                    <td className="py-2 pr-2 text-slate-700">{formatDisplayDate(row.headerData.businessDate)}</td>
                    <td className="py-2 px-2 text-slate-700">{row.headerData.shift}</td>
                    <td className="py-2 px-2 text-slate-700">{row.headerData.managerName}</td>
                    <td className="py-2 px-2 text-slate-700">{toCurrency(serverTotals.serverFinalPay)}</td>
                    <td className="py-2 px-2 text-slate-700">{toCurrency(row.pettyCashData.actualPhysicalCash)}</td>
                    <td className={`py-2 px-2 font-medium ${getDifferenceColorClass(difference)}`}>
                      {toCurrency(difference)}
                    </td>
                    <td className="max-w-[260px] py-2 px-2 text-slate-700" title={row.pettyCashData.comments}>
                      {row.pettyCashData.comments ? truncateComment(row.pettyCashData.comments) : '-'}
                    </td>
                    <td className="py-2 pl-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.status === 'Submitted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-sm text-slate-500">
                    No closeouts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
