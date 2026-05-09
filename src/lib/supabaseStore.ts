import type {
  CloseoutEmailStatus,
  CloseoutRecord,
  ServerOption,
  ServerPayoutRow,
} from '../types/closeout'
import { supabase } from './supabase'

const parseNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const throwIfError = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message)
  }
}

const ensureSupabase = () => {
  if (!supabase) return null
  return supabase
}

export const resolveActiveRestaurantIdFromSupabase = async (): Promise<string | null> => {
  const client = ensureSupabase()
  if (!client) return null

  const { data: restaurants, error: restaurantsError } = await client
    .from('restaurants')
    .select('id, created_at')
    .order('created_at', { ascending: true })

  if (restaurantsError) {
    console.error('Failed to load restaurants.', restaurantsError)
    throw new Error(restaurantsError.message)
  }

  if (restaurants && restaurants.length > 0) {
    if (restaurants.length === 1) return restaurants[0].id

    console.warn(
      'Multiple restaurants found. Defaulting to the first by created_at.',
      restaurants.map((row) => row.id),
    )
    return restaurants[0].id
  }

  const { data: recipientRows, error: recipientsError } = await client
    .from('email_recipients')
    .select('restaurant_id')
    .eq('is_active', true)

  if (recipientsError) {
    console.error('Failed to load restaurant id fallback from email_recipients.', recipientsError)
  } else {
    const uniqueIds = [...new Set((recipientRows ?? []).map((row) => row.restaurant_id).filter(Boolean))]
    if (uniqueIds.length === 1) {
      return uniqueIds[0]
    }
    if (uniqueIds.length > 1) {
      console.warn('Multiple restaurant ids found in email_recipients fallback.', uniqueIds)
      return uniqueIds[0]
    }
  }

  const { data: closeoutRows, error: closeoutsError } = await client
    .from('closeouts')
    .select('restaurant_id')
    .limit(1)

  if (closeoutsError) {
    console.error('Failed to load restaurant id fallback from closeouts.', closeoutsError)
    return null
  }

  return closeoutRows?.[0]?.restaurant_id ?? null
}

const rowToServerPayout = (row: {
  id: string
  row_type: string
  server_id: string | null
  custom_name: string | null
  cash_paid_in: number | string | null
  cash_paid_out: number | string | null
  tip_share: number | string | null
  runner: number | string | null
}): ServerPayoutRow => ({
  id: row.id,
  rowType: row.row_type === 'custom' ? 'custom' : 'standard',
  serverId: row.server_id ?? '',
  customName: row.custom_name ?? '',
  cashPaidIn: parseNumber(row.cash_paid_in),
  cashPaidOut: parseNumber(row.cash_paid_out),
  tipShare: parseNumber(row.tip_share),
  runner: parseNumber(row.runner),
})

export const listServersFromSupabase = async (
  restaurantId: string,
): Promise<ServerOption[] | null> => {
  const client = ensureSupabase()
  if (!client) return null

  const { data, error } = await client
    .from('servers')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  throwIfError(error)

  return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
}

export const listActiveEmailRecipientsFromSupabase = async (
  restaurantId: string,
): Promise<string[] | null> => {
  const client = ensureSupabase()
  if (!client) return null

  const { data, error } = await client
    .from('email_recipients')
    .select('email')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('email', { ascending: true })

  if (error) {
    console.error(`Failed to load email recipients for restaurant ${restaurantId}.`, error)
    throw new Error(error.message)
  }

  return (data ?? [])
    .map((row) => row.email)
    .filter((email): email is string => Boolean(email))
}

export const createServerInSupabase = async (
  name: string,
  restaurantId: string,
): Promise<ServerOption | null> => {
  const client = ensureSupabase()
  if (!client) return null

  const { data, error } = await client
    .from('servers')
    .insert({
      restaurant_id: restaurantId,
      name,
      is_active: true,
    })
    .select('id, name')
    .single()

  throwIfError(error)

  return data ? { id: data.id, name: data.name } : null
}

export const updateServerInSupabase = async (id: string, name: string): Promise<void> => {
  const client = ensureSupabase()
  if (!client) return

  const { error } = await client
    .from('servers')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)

  throwIfError(error)
}

export const deactivateServerInSupabase = async (id: string): Promise<void> => {
  const client = ensureSupabase()
  if (!client) return

  const { error } = await client
    .from('servers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  throwIfError(error)
}

export const listCloseoutsFromSupabase = async (
  restaurantId: string,
): Promise<CloseoutRecord[] | null> => {
  const client = ensureSupabase()
  if (!client) return null

  const { data: closeoutsData, error: closeoutsError } = await client
    .from('closeouts')
    .select(
      'id, business_date, shift, manager_name, backroom_party, status, created_at, submitted_at',
    )
    .eq('restaurant_id', restaurantId)
    .order('business_date', { ascending: false })
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  throwIfError(closeoutsError)

  const closeoutIds = (closeoutsData ?? []).map((row) => row.id)
  if (closeoutIds.length === 0) return []

  const [payoutResult, pettyResult, editsResult] = await Promise.all([
    client
      .from('server_payouts')
      .select(
        'id, closeout_id, row_order, row_type, server_id, custom_name, cash_paid_in, cash_paid_out, tip_share, runner',
      )
      .in('closeout_id', closeoutIds)
      .order('row_order', { ascending: true }),
    client
      .from('petty_cash_records')
      .select('closeout_id, cash_on_hand, receipts, bank_withdrawal, actual_physical_cash, comments')
      .in('closeout_id', closeoutIds),
    client
      .from('closeout_edit_history')
      .select('id, closeout_id, reason, created_at')
      .in('closeout_id', closeoutIds)
      .order('created_at', { ascending: false }),
  ])

  throwIfError(payoutResult.error)
  throwIfError(pettyResult.error)
  throwIfError(editsResult.error)

  const payoutsByCloseout = new Map<string, ServerPayoutRow[]>()
  for (const row of payoutResult.data ?? []) {
    const existing = payoutsByCloseout.get(row.closeout_id) ?? []
    existing.push(rowToServerPayout(row))
    payoutsByCloseout.set(row.closeout_id, existing)
  }

  const pettyByCloseout = new Map(
    (pettyResult.data ?? []).map((row) => [
      row.closeout_id,
      {
        cashOnHand: parseNumber(row.cash_on_hand),
        receipts: parseNumber(row.receipts),
        bankWithdrawal: parseNumber(row.bank_withdrawal),
        actualPhysicalCash: parseNumber(row.actual_physical_cash),
        comments: row.comments ?? '',
      },
    ]),
  )

  const editsByCloseout = new Map<string, CloseoutRecord['editHistory']>()
  for (const row of editsResult.data ?? []) {
    const existing = editsByCloseout.get(row.closeout_id) ?? []
    existing.push({
      id: row.id,
      timestamp: row.created_at,
      reason: row.reason,
    })
    editsByCloseout.set(row.closeout_id, existing)
  }

  return (closeoutsData ?? []).map((row) => ({
    id: row.id,
    headerData: {
      businessDate: row.business_date,
      shift: row.shift,
      managerName: row.manager_name,
      backroomParty: row.backroom_party ? 'Yes' : 'No',
    },
    serverRows: payoutsByCloseout.get(row.id) ?? [],
    pettyCashData: pettyByCloseout.get(row.id) ?? {
      cashOnHand: 0,
      receipts: 0,
      bankWithdrawal: 0,
      actualPhysicalCash: 0,
      comments: '',
    },
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? undefined,
    editHistory: editsByCloseout.get(row.id) ?? [],
  }))
}

export const upsertCloseoutToSupabase = async (
  record: CloseoutRecord,
  restaurantId: string,
  editReason?: string,
): Promise<void> => {
  const client = ensureSupabase()
  if (!client) return

  const { error: closeoutError } = await client
    .from('closeouts')
    .upsert(
      {
        id: record.id,
        restaurant_id: restaurantId,
        business_date: record.headerData.businessDate,
        shift: record.headerData.shift,
        manager_name: record.headerData.managerName,
        backroom_party: record.headerData.backroomParty === 'Yes',
        status: record.status,
        created_at: record.createdAt,
        submitted_at: record.submittedAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  throwIfError(closeoutError)

  const { error: deletePayoutError } = await client
    .from('server_payouts')
    .delete()
    .eq('closeout_id', record.id)

  throwIfError(deletePayoutError)

  if (record.serverRows.length > 0) {
    const { error: insertPayoutError } = await client
      .from('server_payouts')
      .insert(
        record.serverRows.map((row, index) => ({
          id: row.id,
          closeout_id: record.id,
          row_order: index,
          row_type: row.rowType,
          server_id: row.serverId || null,
          custom_name: row.customName || null,
          cash_paid_in: row.cashPaidIn,
          cash_paid_out: row.cashPaidOut,
          tip_share: row.tipShare,
          runner: row.runner,
        })),
      )

    throwIfError(insertPayoutError)
  }

  const { error: pettyError } = await client
    .from('petty_cash_records')
    .upsert(
      {
        closeout_id: record.id,
        cash_on_hand: record.pettyCashData.cashOnHand,
        receipts: record.pettyCashData.receipts,
        bank_withdrawal: record.pettyCashData.bankWithdrawal,
        actual_physical_cash: record.pettyCashData.actualPhysicalCash,
        comments: record.pettyCashData.comments,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'closeout_id' },
    )

  throwIfError(pettyError)

  if (editReason && editReason.trim().length > 0) {
    const { error: editError } = await client.from('closeout_edit_history').insert({
      closeout_id: record.id,
      reason: editReason.trim(),
      created_at: new Date().toISOString(),
    })

    throwIfError(editError)
  }
}

export const sendCloseoutEmailFromSupabase = async (
  closeoutId: string,
  restaurantId: string,
): Promise<CloseoutEmailStatus> => {
  const client = ensureSupabase()
  if (!client) return 'skipped'

  console.log('Calling send-closeout-email')
  const { data, error } = await client.functions.invoke('send-closeout-email', {
    body: { closeoutId, restaurantId },
  })
  console.log('send-closeout-email response', { data, error })

  if (error) {
    console.error('send-closeout-email failed.', error)
    throw new Error(error.message)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response from send-closeout-email function.')
  }

  const response = data as {
    success?: boolean
    skipped?: boolean
    message?: string
  }

  if (response.success) return 'sent'
  if (response.skipped) return 'skipped'

  throw new Error(response.message ?? 'Closeout email sending failed.')
}
