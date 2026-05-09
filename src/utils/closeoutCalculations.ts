import type { PettyCashData, ServerPayoutRow } from '../types/closeout'

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const safeNumber = (value: number) => (Number.isFinite(value) ? value : 0)

export const isEffectivelyZero = (value: number) => Math.abs(value) < 0.005

export const getDifferenceColorClass = (value: number) => {
  if (isEffectivelyZero(value)) return 'text-slate-700'
  if (value < 0) return 'text-red-600'
  return 'text-emerald-700'
}

export const calculateServerFinalPay = (row: ServerPayoutRow) => {
  return roundMoney(
    safeNumber(row.cashPaidOut) -
      safeNumber(row.tipShare) -
      safeNumber(row.runner) -
      safeNumber(row.cashPaidIn),
  )
}

export const calculateServerTotals = (rows: ServerPayoutRow[]) => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.cashPaidIn += safeNumber(row.cashPaidIn)
      acc.cashPaidOut += safeNumber(row.cashPaidOut)
      acc.tipShare += safeNumber(row.tipShare)
      acc.runner += safeNumber(row.runner)
      acc.serverFinalPay += calculateServerFinalPay(row)
      return acc
    },
    { cashPaidIn: 0, cashPaidOut: 0, tipShare: 0, runner: 0, serverFinalPay: 0 },
  )

  return {
    cashPaidIn: roundMoney(totals.cashPaidIn),
    cashPaidOut: roundMoney(totals.cashPaidOut),
    tipShare: roundMoney(totals.tipShare),
    runner: roundMoney(totals.runner),
    serverFinalPay: roundMoney(totals.serverFinalPay),
  }
}

export const calculatePettyCashSummary = (
  pettyCashData: PettyCashData,
  totalServerFinalPay: number,
) => {
  const dailyTotal = roundMoney(safeNumber(pettyCashData.cashOnHand) + safeNumber(pettyCashData.receipts))
  const beforePayoutCash = roundMoney(
    safeNumber(pettyCashData.cashOnHand) + safeNumber(pettyCashData.bankWithdrawal),
  )
  const idealEodPhysicalCash = roundMoney(beforePayoutCash - safeNumber(totalServerFinalPay))
  const difference = roundMoney(safeNumber(pettyCashData.actualPhysicalCash) - idealEodPhysicalCash)

  return {
    dailyTotal,
    beforePayoutCash,
    idealEodPhysicalCash,
    difference,
  }
}
