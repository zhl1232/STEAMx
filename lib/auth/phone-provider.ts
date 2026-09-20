/**
 * Selects the phone authentication implementation without exposing provider
 * configuration to the browser. Keep legacy as the default until the target
 * Supabase project has its phone provider configured.
 */
export function isSupabasePhoneProvider(): boolean {
  return process.env.AUTH_PHONE_PROVIDER?.trim().toLowerCase() === 'supabase'
}
