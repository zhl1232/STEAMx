// Test-only boundary: never creates a real account, sends SMS or contacts Supabase.
const subscribers = new Set()
const storedUser = () => { try { return sessionStorage.getItem('fixture-auth') } catch { return null } }
const user = { id: 'fixture-user', email: 'fixture@example.test', user_metadata: {} }
const auth = {
  onAuthStateChange(callback) {
    subscribers.add(callback)
    const timer = setTimeout(() => callback('INITIAL_SESSION', storedUser() ? {user} : null), 30)
    return { data: { subscription: { unsubscribe() { clearTimeout(timer); subscribers.delete(callback) } } } }
  },
  async setSession() {
    sessionStorage.setItem('fixture-auth','1')
    subscribers.forEach(callback => callback('SIGNED_IN', {user}))
    return { data: { user }, error: null }
  },
  async verifyOtp() { return auth.setSession() },
  async signInWithPassword() { return auth.setSession() },
}
export const createClient = () => ({ auth, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({data: null}) }) }) }) })
