import type { CloseoutRecord, ShiftType } from '../types/closeout'
import { calculatePettyCashSummary, calculateServerTotals } from './closeoutCalculations'

export const getCloseoutServerTotals = (record: CloseoutRecord) => {
  return calculateServerTotals(record.serverRows)
}

export const getCloseoutPettySummary = (record: CloseoutRecord) => {
  const serverTotals = getCloseoutServerTotals(record)
  return calculatePettyCashSummary(record.pettyCashData, serverTotals.serverFinalPay)
}

export const getCloseoutDifference = (record: CloseoutRecord) => {
  return getCloseoutPettySummary(record).difference
}

export const getCloseoutSortTimestamp = (record: CloseoutRecord) => {
  const businessDateMs = new Date(`${record.headerData.businessDate}T00:00:00`).getTime()
  const submittedMs = new Date(record.submittedAt ?? record.createdAt).getTime()
  return { businessDateMs, submittedMs }
}

export const getShiftRank = (shift: ShiftType) => (shift === 'Lunch' ? 0 : 1)
