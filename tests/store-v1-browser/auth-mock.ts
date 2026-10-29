/** Synthetic identity only; this module is aliased exclusively by the localhost fixture server. */
export function useAuth() {
  const founder = new URLSearchParams(location.search).get('tier') === 'founder'
  return { user: { id: 'fixture-user' }, profile: { membership_tier: founder ? 'founder' : 'pro', membership_period: founder ? 'founder' : 'lifetime' }, loading: false }
}
