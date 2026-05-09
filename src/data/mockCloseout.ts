import type {
  CloseoutHeaderData,
  CloseoutRecord,
  PettyCashData,
  ServerOption,
  ServerPayoutRow,
} from '../types/closeout'
import { getCurrentShiftFromLocalTime, getIsoDateToday } from '../utils/date'

const makeStandardRow = (
  id: string,
  serverId: string,
  cashPaidIn: number,
  cashPaidOut: number,
  tipShare: number,
  runner: number,
): ServerPayoutRow => ({
  id,
  rowType: 'standard',
  serverId,
  customName: '',
  cashPaidIn,
  cashPaidOut,
  tipShare,
  runner,
})

const makeCustomRow = (
  id: string,
  customName: string,
  cashPaidIn: number,
  cashPaidOut: number,
  tipShare: number,
  runner: number,
): ServerPayoutRow => ({
  id,
  rowType: 'custom',
  serverId: '',
  customName,
  cashPaidIn,
  cashPaidOut,
  tipShare,
  runner,
})

export const initialHeaderData: CloseoutHeaderData = {
  businessDate: getIsoDateToday(),
  shift: getCurrentShiftFromLocalTime(),
  managerName: 'Sarah',
  backroomParty: 'No',
}

export const initialPettyCashData: PettyCashData = {
  cashOnHand: 640,
  receipts: 182.25,
  bankWithdrawal: 400,
  actualPhysicalCash: 1506,
  comments: '',
}

export const initialServerOptions: ServerOption[] = [
  { id: 'srv-1', name: 'Maya R.' },
  { id: 'srv-2', name: 'Dylan K.' },
  { id: 'srv-3', name: 'Jordan V.' },
  { id: 'srv-4', name: 'Renee O.' },
  { id: 'srv-5', name: 'Noah T.' },
  { id: 'srv-6', name: 'Kiara S.' },
  { id: 'srv-7', name: 'Ethan B.' },
  { id: 'srv-8', name: 'Leah F.' },
  { id: 'srv-9', name: 'Theo C.' },
  { id: 'srv-10', name: 'Sofia M.' },
]

export const initialCloseoutHistory: CloseoutRecord[] = [
  {
    id: 'CO-2401',
    headerData: {
      businessDate: '2026-05-07',
      shift: 'Dinner',
      managerName: 'Jocelyn',
      backroomParty: 'No',
    },
    serverRows: [
      makeStandardRow('h1-s1', 'srv-1', 120, 410, 55, 22),
      makeStandardRow('h1-s2', 'srv-2', 95, 365, 48, 18),
      makeStandardRow('h1-s3', 'srv-3', 140, 450, 62, 24),
      makeCustomRow('h1-c1', 'Temp Banquet Server', 60, 210, 30, 10),
    ],
    pettyCashData: {
      cashOnHand: 730,
      receipts: 164,
      bankWithdrawal: 300,
      actualPhysicalCash: 1210,
      comments: 'Missing one beverage receipt, manager verified after recount.',
    },
    status: 'Submitted',
    createdAt: '2026-05-07T20:40:00.000Z',
    submittedAt: '2026-05-08T00:10:00.000Z',
    editHistory: [],
  },
  {
    id: 'CO-2400',
    headerData: {
      businessDate: '2026-05-07',
      shift: 'Lunch',
      managerName: 'Ninad',
      backroomParty: 'Yes',
    },
    serverRows: [
      makeStandardRow('h2-s1', 'srv-4', 80, 210, 31, 14),
      makeStandardRow('h2-s2', 'srv-5', 65, 188, 26, 11),
      makeStandardRow('h2-s3', 'srv-6', 72, 204, 29, 13),
      makeStandardRow('h2-s4', 'srv-8', 58, 170, 24, 9),
      makeStandardRow('h2-s5', 'srv-9', 52, 161, 21, 8),
    ],
    pettyCashData: {
      cashOnHand: 520,
      receipts: 90,
      bankWithdrawal: 200,
      actualPhysicalCash: 893,
      comments: 'Balanced after first count.',
    },
    status: 'Submitted',
    createdAt: '2026-05-07T15:00:00.000Z',
    submittedAt: '2026-05-07T18:02:00.000Z',
    editHistory: [],
  },
  {
    id: 'CO-2399',
    headerData: {
      businessDate: '2026-05-06',
      shift: 'Dinner',
      managerName: 'Sandeep',
      backroomParty: 'No',
    },
    serverRows: [
      makeStandardRow('h3-s1', 'srv-1', 101, 390, 52, 19),
      makeStandardRow('h3-s2', 'srv-2', 110, 402, 54, 20),
      makeStandardRow('h3-s3', 'srv-7', 105, 384, 50, 18),
    ],
    pettyCashData: {
      cashOnHand: 700,
      receipts: 120,
      bankWithdrawal: 250,
      actualPhysicalCash: 1260,
      comments: 'Pending review for produce run cash-out.',
    },
    status: 'Draft',
    createdAt: '2026-05-06T23:20:00.000Z',
    editHistory: [
      {
        id: 'note-1',
        timestamp: '2026-05-07T00:05:00.000Z',
        reason: 'Adjusted runner payout after POS correction.',
      },
    ],
  },
]
