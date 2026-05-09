import type { CloseoutRecord, ServerPayoutRow, ShiftType } from '../types/closeout'

export const getMinimumStandardRows = (shift: ShiftType) => (shift === 'Lunch' ? 5 : 10)

export const createStandardServerRow = (serverId = ''): ServerPayoutRow => ({
  id: `s-${crypto.randomUUID()}`,
  rowType: 'standard',
  serverId,
  customName: '',
  cashPaidIn: 0,
  cashPaidOut: 0,
  tipShare: 0,
  runner: 0,
})

export const createCustomServerRow = (): ServerPayoutRow => ({
  id: `s-${crypto.randomUUID()}`,
  rowType: 'custom',
  serverId: '',
  customName: '',
  cashPaidIn: 0,
  cashPaidOut: 0,
  tipShare: 0,
  runner: 0,
})

const rowHasNumericValues = (row: ServerPayoutRow) => {
  return (
    (Number.isFinite(row.cashPaidIn) && row.cashPaidIn !== 0) ||
    (Number.isFinite(row.cashPaidOut) && row.cashPaidOut !== 0) ||
    (Number.isFinite(row.tipShare) && row.tipShare !== 0) ||
    (Number.isFinite(row.runner) && row.runner !== 0)
  )
}

const isStandardBlank = (row: ServerPayoutRow) => {
  if (row.rowType !== 'standard') return false
  return row.serverId.trim().length === 0 && !rowHasNumericValues(row)
}

export const hasRowData = (row: ServerPayoutRow) => {
  if (row.rowType === 'custom') {
    return row.customName.trim().length > 0 || rowHasNumericValues(row)
  }
  return row.serverId.trim().length > 0 || rowHasNumericValues(row)
}

export const normalizeRowsForShift = (rows: ServerPayoutRow[], shift: ShiftType) => {
  const minStandardRows = getMinimumStandardRows(shift)
  const standardRows = rows.filter((row) => row.rowType === 'standard').length

  let nextRows = [...rows]

  if (standardRows < minStandardRows) {
    const neededRows = minStandardRows - standardRows
    nextRows = [...nextRows, ...Array.from({ length: neededRows }, () => createStandardServerRow())]
  }

  if (standardRows > minStandardRows) {
    const removableCount = standardRows - minStandardRows
    let removed = 0
    nextRows = [...nextRows]
      .reverse()
      .filter((row) => {
        if (removed >= removableCount) return true
        if (isStandardBlank(row)) {
          removed += 1
          return false
        }
        return true
      })
      .reverse()
  }

  return nextRows
}

export const getPrefillServerIdsFromCloseout = (record: CloseoutRecord | undefined) => {
  if (!record) return []

  const ids: string[] = []
  for (const row of record.serverRows) {
    if (row.rowType === 'standard' && row.serverId.trim()) {
      ids.push(row.serverId)
    }
  }
  return ids
}

export const buildInitialRowsForShift = (shift: ShiftType, prefillServerIds: string[]) => {
  const minStandardRows = getMinimumStandardRows(shift)
  const usedServerIds = prefillServerIds.slice(0, minStandardRows)

  const rows: ServerPayoutRow[] = usedServerIds.map((serverId) => createStandardServerRow(serverId))

  while (rows.length < minStandardRows) {
    rows.push(createStandardServerRow())
  }

  return rows
}
