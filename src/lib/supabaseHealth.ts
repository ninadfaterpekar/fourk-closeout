import { isSupabaseConfigured, supabase } from './supabase'
import { resolveActiveRestaurantIdFromSupabase } from './supabaseStore'

const HEALTHCHECK_SERVER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

const getMissingEnvVars = () => {
  const missing: string[] = []
  if (!import.meta.env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')
  return missing
}

export const runSupabaseHealthCheck = async () => {
  if (!isSupabaseConfigured || !supabase) {
    const missing = getMissingEnvVars()
    console.info(
      `[Supabase Health] Skipped: missing environment variables (${missing.join(', ')}). Using local fallback mode.`,
    )
    return
  }

  try {
    const { data, error } = await supabase.from('closeouts').select('id').limit(1)

    if (error) {
      console.info('[Supabase Health] Connected to Supabase.')
      console.warn(
        `[Supabase Health] closeouts table query failed: ${error.message}`,
      )
      return
    }

    console.info('[Supabase Health] Connected to Supabase.')
    console.info(
      `[Supabase Health] closeouts table query succeeded (sample rows: ${data?.length ?? 0}).`,
    )

    const restaurantId = await resolveActiveRestaurantIdFromSupabase()
    if (!restaurantId) {
      console.warn('[Supabase Health] No active restaurant found. Skipping write probe.')
      return
    }
    console.info(`[Supabase Health] Loaded active restaurant id: ${restaurantId}`)

    const { error: writeProbeError } = await supabase
      .from('servers')
      .upsert(
        {
          id: HEALTHCHECK_SERVER_ID,
          restaurant_id: restaurantId,
          name: 'Health Check Server',
          is_active: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

    if (writeProbeError) {
      console.warn(
        `[Supabase Health] Write probe failed for servers table: ${writeProbeError.message}`,
      )
    } else {
      console.info('[Supabase Health] Write probe succeeded for servers table.')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Supabase Health] Connection check failed: ${message}`)
  }
}
