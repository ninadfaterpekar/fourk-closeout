import { isSupabaseConfigured, supabase } from './supabase'
import { resolveActiveRestaurantIdFromSupabase } from './supabaseStore'

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
    const { data, error } = await supabase.from('restaurants').select('*').limit(1)

    if (error) {
      console.info('[Supabase Health] Connected to Supabase.')
      console.error('[Supabase Health] restaurants query failed.', error)
      return
    }

    console.info('[Supabase Health] Connected to Supabase.')
    console.info(
      `[Supabase Health] restaurants query succeeded (sample rows: ${data?.length ?? 0}).`,
    )

    try {
      const restaurantId = await resolveActiveRestaurantIdFromSupabase()
      console.info(`[Supabase Health] Loaded active restaurant id: ${restaurantId ?? 'none'}`)
    } catch (restaurantError) {
      console.error('[Supabase Health] Restaurant loading failed.', restaurantError)
    }
  } catch (error) {
    console.error('[Supabase Health] Connection check failed.', error)
  }
}
