import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

type CloseoutRow = {
  id: string
  restaurant_id: string
  business_date: string
  shift: 'Lunch' | 'Dinner'
  manager_name: string
  backroom_party: boolean
  status: 'Draft' | 'Submitted'
}

type PettyCashRow = {
  cash_on_hand: number
  receipts: number
  bank_withdrawal: number
  actual_physical_cash: number
  comments: string
}

type ServerPayoutRow = {
  id: string
  row_type: 'standard' | 'custom'
  server_id: string | null
  custom_name: string | null
  cash_paid_in: number
  cash_paid_out: number
  tip_share: number
  runner: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const safeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatDisplayDate = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const year = String(parsed.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

const getDayOfWeek = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', { weekday: 'long' })
}

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

const calculateServerFinalPay = (row: ServerPayoutRow) =>
  roundMoney(
    safeNumber(row.cash_paid_out) -
      safeNumber(row.tip_share) -
      safeNumber(row.runner) -
      safeNumber(row.cash_paid_in),
  )

const buildServerTotals = (rows: ServerPayoutRow[]) => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.finalPay += calculateServerFinalPay(row)
      return acc
    },
    { finalPay: 0 },
  )

  return {
    finalPay: roundMoney(totals.finalPay),
  }
}

const getServerRowName = (row: ServerPayoutRow, serverNameMap: Map<string, string>) => {
  if (row.row_type === 'custom') return (row.custom_name ?? '').trim()
  return (serverNameMap.get(row.server_id ?? '') ?? '').trim()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const resendFromEmail =
    Deno.env.get('RESEND_FROM_EMAIL') ?? 'Fourk Closeout <onboarding@resend.dev>'

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, message: 'Supabase function secrets are missing.' },
      500,
    )
  }

  if (!resendApiKey) {
    return jsonResponse(
      { success: false, message: 'RESEND_API_KEY is not configured.' },
      500,
    )
  }

  const payload = (await request.json().catch(() => null)) as {
    closeoutId?: string
    restaurantId?: string
  } | null
  const closeoutId = payload?.closeoutId?.trim()
  if (!closeoutId) {
    return jsonResponse({ success: false, message: 'closeoutId is required.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: closeout, error: closeoutError } = await adminClient
    .from('closeouts')
    .select(
      'id, restaurant_id, business_date, shift, manager_name, backroom_party, status',
    )
    .eq('id', closeoutId)
    .single<CloseoutRow>()

  if (closeoutError || !closeout) {
    return jsonResponse(
      { success: false, message: closeoutError?.message ?? 'Closeout not found.' },
      404,
    )
  }

  if (closeout.status !== 'Submitted') {
    return jsonResponse({
      success: true,
      skipped: true,
      message: 'Closeout is not submitted. Email skipped.',
    })
  }

  const recipientRestaurantId = payload?.restaurantId?.trim() || closeout.restaurant_id
  console.log('Loaded active restaurant id', recipientRestaurantId)

  const [{ data: recipients, error: recipientsError }, { data: pettyCash }, { data: payouts, error: payoutsError }] =
    await Promise.all([
      adminClient
        .from('email_recipients')
        .select('email')
        .eq('restaurant_id', recipientRestaurantId)
        .eq('is_active', true)
        .order('email', { ascending: true }),
      adminClient
        .from('petty_cash_records')
        .select('cash_on_hand, receipts, bank_withdrawal, actual_physical_cash, comments')
        .eq('closeout_id', closeoutId)
        .maybeSingle<PettyCashRow>(),
      adminClient
        .from('server_payouts')
        .select(
          'id, row_type, server_id, custom_name, cash_paid_in, cash_paid_out, tip_share, runner',
        )
        .eq('closeout_id', closeoutId)
        .order('row_order', { ascending: true })
        .returns<ServerPayoutRow[]>(),
    ])

  if (recipientsError) {
    console.error('Failed to load active email recipients.', recipientsError)
    return jsonResponse({ success: false, message: recipientsError.message }, 500)
  }

  if (payoutsError) {
    console.error('Failed to load server payouts.', payoutsError)
    return jsonResponse({ success: false, message: payoutsError.message }, 500)
  }

  const toEmails = (recipients ?? []).map((row) => row.email).filter(Boolean)
  console.log('Loaded active email recipients', toEmails)
  if (toEmails.length === 0) {
    return jsonResponse(
      {
        success: false,
        message: `No active email recipients configured for restaurant ${recipientRestaurantId}.`,
      },
      400,
    )
  }

  const serverRows = payouts ?? []
  const standardServerIds = [...new Set(serverRows.map((row) => row.server_id).filter(Boolean))] as string[]

  const serverNameMap = new Map<string, string>()
  if (standardServerIds.length > 0) {
    const { data: servers } = await adminClient
      .from('servers')
      .select('id, name')
      .in('id', standardServerIds)

    for (const server of servers ?? []) {
      serverNameMap.set(server.id, server.name)
    }
  }

  const meaningfulServerRows = serverRows.filter(
    (row) => getServerRowName(row, serverNameMap).length > 0,
  )
  const totals = buildServerTotals(meaningfulServerRows)
  const cashOnHand = safeNumber(pettyCash?.cash_on_hand)
  const bankWithdrawal = safeNumber(pettyCash?.bank_withdrawal)
  const actualFinalCash = safeNumber(pettyCash?.actual_physical_cash)
  const comments = pettyCash?.comments ?? ''

  const beforePayoutCash = roundMoney(cashOnHand + bankWithdrawal)
  const idealEodCash = roundMoney(beforePayoutCash - totals.finalPay)
  const difference = roundMoney(actualFinalCash - idealEodCash)

  const dateDisplay = formatDisplayDate(closeout.business_date)
  const dayOfWeek = getDayOfWeek(closeout.business_date)
  const subject = `Fourk ${closeout.shift} Closeout: ${dateDisplay}`

  const serverTableRowsHtml = meaningfulServerRows
    .map((row) => {
      const serverName = getServerRowName(row, serverNameMap)
      const finalPay = calculateServerFinalPay(row)

      return `
        <tr>
          <td style="padding:6px;border:1px solid #dbe3ef;">${escapeHtml(serverName)}</td>
          <td style="padding:6px;border:1px solid #dbe3ef;text-align:right;">${toCurrency(safeNumber(row.cash_paid_in))}</td>
          <td style="padding:6px;border:1px solid #dbe3ef;text-align:right;">${toCurrency(safeNumber(row.cash_paid_out))}</td>
          <td style="padding:6px;border:1px solid #dbe3ef;text-align:right;">${toCurrency(safeNumber(row.tip_share))}</td>
          <td style="padding:6px;border:1px solid #dbe3ef;text-align:right;">${toCurrency(safeNumber(row.runner))}</td>
          <td style="padding:6px;border:1px solid #dbe3ef;text-align:right;font-weight:600;">${toCurrency(finalPay)}</td>
        </tr>
      `
    })
    .join('')

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.4;">
      <h2 style="margin:0 0 12px;">${escapeHtml(subject)}</h2>
      <p><strong>Date:</strong> ${escapeHtml(dateDisplay)}</p>
      <p><strong>Day of Week:</strong> ${escapeHtml(dayOfWeek)}</p>
      <p><strong>Shift:</strong> ${escapeHtml(closeout.shift)}</p>
      <p><strong>Manager on Duty:</strong> ${escapeHtml(closeout.manager_name)}</p>
      <p><strong>Backroom Party:</strong> ${closeout.backroom_party ? 'Yes' : 'No'}</p>
      <p><strong>Final Pay:</strong> ${toCurrency(totals.finalPay)}</p>
      <p><strong>Ideal EOD Cash:</strong> ${toCurrency(idealEodCash)}</p>
      <p><strong>Actual Final Cash:</strong> ${toCurrency(actualFinalCash)}</p>
      <p><strong>Difference:</strong> ${toCurrency(difference)}</p>
      <p><strong>Comments:</strong> ${escapeHtml(comments || 'No comments provided.')}</p>

      <h3 style="margin-top:20px;">Server Payout Table</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr>
            <th style="padding:6px;border:1px solid #dbe3ef;text-align:left;">Server Name</th>
            <th style="padding:6px;border:1px solid #dbe3ef;text-align:right;">Cash Paid In</th>
            <th style="padding:6px;border:1px solid #dbe3ef;text-align:right;">Cash Paid Out</th>
            <th style="padding:6px;border:1px solid #dbe3ef;text-align:right;">Tip Share</th>
            <th style="padding:6px;border:1px solid #dbe3ef;text-align:right;">Runner</th>
            <th style="padding:6px;border:1px solid #dbe3ef;text-align:right;">Server Final Pay</th>
          </tr>
        </thead>
        <tbody>
          ${serverTableRowsHtml || '<tr><td colspan="6" style="padding:6px;border:1px solid #dbe3ef;">No server rows.</td></tr>'}
        </tbody>
      </table>
    </div>
  `

  const text = [
    subject,
    '',
    `Date: ${dateDisplay}`,
    `Day of Week: ${dayOfWeek}`,
    `Shift: ${closeout.shift}`,
    `Manager on Duty: ${closeout.manager_name}`,
    `Backroom Party: ${closeout.backroom_party ? 'Yes' : 'No'}`,
    `Final Pay: ${toCurrency(totals.finalPay)}`,
    `Ideal EOD Cash: ${toCurrency(idealEodCash)}`,
    `Actual Final Cash: ${toCurrency(actualFinalCash)}`,
    `Difference: ${toCurrency(difference)}`,
    `Comments: ${comments || 'No comments provided.'}`,
  ].join('\n')

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: toEmails,
      subject,
      html,
      text,
    }),
  })

  const resendPayload = await resendResponse.json().catch(() => null)
  if (!resendResponse.ok) {
    console.error('Resend API request failed.', {
      status: resendResponse.status,
      statusText: resendResponse.statusText,
      payload: resendPayload,
    })

    const resendMessage =
      resendPayload &&
      typeof resendPayload === 'object' &&
      'message' in resendPayload &&
      typeof resendPayload.message === 'string'
        ? resendPayload.message
        : null

    return jsonResponse(
      {
        success: false,
        message:
          resendMessage ??
          `Resend API request failed with status ${resendResponse.status} ${resendResponse.statusText}.`,
        resend: resendPayload,
        status: resendResponse.status,
      },
      502,
    )
  }

  return jsonResponse({
    success: true,
    message: 'Closeout email sent.',
    resend: resendPayload,
    recipients: toEmails.length,
  })
})
