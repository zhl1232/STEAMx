import { useSyncExternalStore } from 'react'
function subscribe(cb) { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb) }
export function usePathname() { return useSyncExternalStore(subscribe, () => location.pathname) }
const router = { push(href) { history.pushState({}, '', href); dispatchEvent(new PopStateEvent('popstate')) }, refresh() {}, back() { history.back() } }
export function useRouter() { return router }
export function useSearchParams() { return new URLSearchParams(location.search) }
