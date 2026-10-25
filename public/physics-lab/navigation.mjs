import { defaultNavigation, normalizeNavigation, parseNavigation, navigationSearch, NAVIGATION_KEYS } from './navigation-state.mjs';

export function createLabNavigation({ onRoute, embedded = false, win = globalThis }) {
  const documentId = win.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  let current = embedded ? defaultNavigation() : parseNavigation(win.location.search);
  let pending = [];
  const key = route => JSON.stringify(route);
  const apply = route => { if (key(route) === key(current)) return; current = route; onRoute({ ...route }); };
  const ready = () => win.parent.postMessage({ type: 'steamx-physics-navigation-ready', version: 1, documentId }, win.location.origin);
  function receive(event) {
    if (event.source !== win.parent || event.origin !== win.location.origin || event.data?.version !== 1) return;
    const message = event.data;
    if (message.type === 'steamx-physics-navigation-request') { ready(); return; }
    if (message.type !== 'steamx-physics-navigation-state' || message.documentId !== documentId) return;
    const route = normalizeNavigation(message.route); if (!route) return;
    const index = pending.indexOf(key(route));
    if (index >= 0) { pending.splice(0, index + 1); if (pending.length) return; }
    else pending = [];
    apply(route);
  }
  const pop = () => apply(parseNavigation(win.location.search));
  if (embedded) win.addEventListener('message', receive); else win.addEventListener('popstate', pop);
  onRoute({ ...current });
  if (embedded) ready();
  return {
    current: () => ({ ...current }),
    href: route => (embedded ? '/playground/physics-lab' : win.location.pathname) + navigationSearch(route),
    navigate(input, { replace = false } = {}) {
      const route = normalizeNavigation(input); if (!route) return;
      if (key(route) === key(current)) { onRoute({ ...route }); return; }
      if (embedded) {
        pending.push(key(route));
        if (pending.length > 100) pending = pending.slice(-100);
        apply(route);
        win.parent.postMessage({ type: 'steamx-physics-navigate', version: 1, documentId, route, replace }, win.location.origin);
      } else {
        const url = new URL(win.location.href);
        for (const name of NAVIGATION_KEYS) url.searchParams.delete(name);
        for (const [name, value] of new URLSearchParams(navigationSearch(route))) url.searchParams.set(name, value);
        win.history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
        apply(route);
      }
    },
    destroy() { win.removeEventListener(embedded ? 'message' : 'popstate', embedded ? receive : pop); pending = []; },
  };
}
