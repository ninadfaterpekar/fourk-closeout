import type {
  CloseoutEmailStatus,
  CloseoutRecord,
  ServerOption,
  ServerPayoutRow,
} from '../types/closeout'
import type { ActivityLogEntry, ActivityLogPayload } from '../types/activity'
import { supabase } from './supabase'

export const FALLBACK_RESTAURANT_ID = '24aca723-2050-436c-b42b-c83e23428b1e'

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

const logActiveRestaurantId = (restaurantId: string) => {
  console.log(`Using active restaurant id: ${restaurantId}`)
}

export const resolveActiveRestaurantIdFromSupabase = async (): Promise<string> => {
  const client = ensureSupabase()
  if (!client) {
    console.warn('Supabase client unavailable. Using fallback restaurant id.')
    logActiveRestaurantId(FALLBACK_RESTAURANT_ID)
    return FALLBACK_RESTAURANT_ID
  }

  try {
    const fourkQuery = await client
      .from('restaurants')
      .select('*')
      .eq('name', 'Fourk')
      .single()

    if (!fourkQuery.error && fourkQuery.data) {
      console.log('Restaurant query result (Fourk)', fourkQuery.data)
      logActiveRestaurantId(fourkQuery.data.id)
      return fourkQuery.data.id
    }

    if (fourkQuery.error) {
      console.error('Restaurant query by name failed.', fourkQuery.error)
    }

    const fallbackQuery = await client.from('restaurants').select('*').limit(1)
    if (fallbackQuery.error) {
      console.error('Fallback restaurant query failed.', fallbackQuery.error)
      console.warn('Using fallback restaurant id.', FALLBACK_RESTAURANT_ID)
      return FALLBACK_RESTAURANT_ID
    }

    const firstRestaurant = fallbackQuery.data?.[0]
    console.log('Restaurant query result (first row fallback)', firstRestaurant ?? null)

    if (firstRestaurant?.id) {
      logActiveRestaurantId(firstRestaurant.id)
      return firstRestaurant.id
    }

    console.warn('No restaurants returned. Using fallback restaurant id.', FALLBACK_RESTAURANT_ID)
    logActiveRestaurantId(FALLBACK_RESTAURANT_ID)
    return FALLBACK_RESTAURANT_ID
  } catch (error) {
    console.error('Failed to resolve active restaurant id.', error)
    console.warn('Using fallback restaurant id.', FALLBACK_RESTAURANT_ID)
    logActiveRestaurantId(FALLBACK_RESTAURANT_ID)
    return FALLBACK_RESTAURANT_ID
  }
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

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('is_active')) {
      const fallback = await client
        .from('servers')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true })
      throwIfError(fallback.error)
      return (fallback.data ?? []).map((row) => ({ id: row.id, name: row.name }))
    }
    throw new Error(error.message)
  }

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

  const payload = {
    restaurant_id: restaurantId,
    name,
    is_active: true,
  }
  console.log('Server insert payload', payload)

  const { data, error } = await client
    .from('servers')
    .insert(payload)
    .select('id, name')
    .single()

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('is_active')) {
      const fallback = await client
        .from('servers')
        .insert({
          restaurant_id: restaurantId,
          name,
        })
        .select('id, name')
        .single()

      if (fallback.error) {
        console.error('Supabase servers insert fallback failed.', {
          error: fallback.error,
          payload,
        })
        throw new Error(fallback.error.message)
      }

      return fallback.data ? { id: fallback.data.id, name: fallback.data.name } : null
    }

    console.error('Supabase servers insert failed.', { error, payload })
    throw new Error(error.message)
  }

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

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('is_active')) {
      const fallback = await client.from('servers').delete().eq('id', id)
      throwIfError(fallback.error)
      return
    }
    throw new Error(error.message)
  }
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

export const deleteCloseoutFromSupabase = async (closeoutId: string): Promise<void> => {
  const client = ensureSupabase()
  if (!client) return

  const [payoutDelete, pettyDelete, editsDelete] = await Promise.all([
    client.from('server_payouts').delete().eq('closeout_id', closeoutId),
    client.from('petty_cash_records').delete().eq('closeout_id', closeoutId),
    client.from('closeout_edit_history').delete().eq('closeout_id', closeoutId),
  ])
  throwIfError(payoutDelete.error)
  throwIfError(pettyDelete.error)
  throwIfError(editsDelete.error)

  const { error } = await client.from('closeouts').delete().eq('id', closeoutId)
  throwIfError(error)
}

export const createActivityLogInSupabase = async (
  restaurantId: string,
  payload: ActivityLogPayload,
): Promise<void> => {
  const client = ensureSupabase()
  if (!client) return

  const { error } = await client.from('activity_logs').insert({
    restaurant_id: restaurantId,
    actor_pin: payload.actorPin,
    actor_name: payload.actorName,
    actor_role: payload.actorRole,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    details: payload.details,
    created_at: new Date().toISOString(),
  })

  if (error) {
    const message = error.message.toLowerCase()
    const code = (error as { code?: string }).code ?? ''
    if (code === '42P01' || message.includes('activity_logs')) {
      console.warn('Activity log table unavailable. Skipping activity logging.', error)
      return
    }
    throw new Error(error.message)
  }
}

export const listActivityLogsFromSupabase = async (
  restaurantId: string,
): Promise<ActivityLogEntry[] | null> => {
  const client = ensureSupabase()
  if (!client) return null

  const { data, error } = await client
    .from('activity_logs')
    .select('id, restaurant_id, actor_pin, actor_name, actor_role, action, entity_type, entity_id, details, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) {
    const message = error.message.toLowerCase()
    const code = (error as { code?: string }).code ?? ''
    if (code === '42P01' || message.includes('activity_logs')) {
      console.warn('Activity log table unavailable. Returning empty activity logs.', error)
      return []
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    actorPin: row.actor_pin,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details,
    createdAt: row.created_at,
  }))
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
    const responseContext = (error as { context?: Response }).context
    let contextPayload: unknown = null
    let contextText: string | null = null
    let contextStatus: number | null = null

    if (responseContext) {
      contextStatus = responseContext.status
      try {
        contextPayload = await responseContext.clone().json()
      } catch {
        try {
          contextText = await responseContext.clone().text()
        } catch {
          contextText = null
        }
      }
    }

    console.error('send-closeout-email failed.', {
      error,
      status: contextStatus,
      payload: contextPayload,
      text: contextText,
    })

    const edgeMessage =
      (contextPayload &&
      typeof contextPayload === 'object' &&
      'message' in contextPayload &&
      typeof contextPayload.message === 'string')
        ? contextPayload.message
        : contextText

    throw new Error(edgeMessage || error.message || 'Email failed to send.')
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

  throw new Error(response.message ?? 'Email failed to send.')
}
