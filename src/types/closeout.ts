export type ShiftType = 'Lunch' | 'Dinner'

export type ServerRowType = 'standard' | 'custom'

export type CloseoutStatus = 'Draft' | 'Submitted'

export type BackroomPartyType = 'Yes' | 'No'

export type ServerOption = {
  id: string
  name: string
}

export type ServerPayoutRow = {
  id: string
  rowType: ServerRowType
  serverId: string
  customName: string
  cashPaidIn: number
  cashPaidOut: number
  tipShare: number
  runner: number
}

export type PettyCashData = {
  cashOnHand: number
  receipts: number
  bankWithdrawal: number
  actualPhysicalCash: number
  comments: string
}

export type CloseoutHeaderData = {
  businessDate: string
  shift: ShiftType
  managerName: string
  backroomParty: BackroomPartyType
}

export type CloseoutChangeNote = {
  id: string
  timestamp: string
  reason: string
}

export type CloseoutRecord = {
  id: string
  headerData: CloseoutHeaderData
  serverRows: ServerPayoutRow[]
  pettyCashData: PettyCashData
  status: CloseoutStatus
  createdAt: string
  submittedAt?: string
  editHistory: CloseoutChangeNote[]
}

export type NewCloseoutPayload = {
  headerData: CloseoutHeaderData
  serverRows: ServerPayoutRow[]
  pettyCashData: PettyCashData
  status: CloseoutStatus
}

export type EditCloseoutPayload = {
  headerData: CloseoutHeaderData
  serverRows: ServerPayoutRow[]
  pettyCashData: PettyCashData
  status: CloseoutStatus
  reason: string
}
