import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORATIONS } from '../../public/physics-lab/exploration-model.mjs';
import { LESSONS } from '../../public/physics-lab/learning-model.mjs';
import { defaultNavigation, normalizeNavigation, parseNavigation, navigationSearch } from '../../public/physics-lab/navigation-state.mjs';
import { createLabNavigation } from '../../public/physics-lab/navigation.mjs';

function environment(search = '') {
  let url = new URL('https://lab.example/physics-lab/index.html' + search);
  const events = new Map(), sent = [], visited = [], parent = { postMessage: (message, origin) => sent.push({ message, origin }) };
  const win = { get location() { return url; }, parent, crypto: { randomUUID: () => 'navigation-document' },
    addEventListener(type, callback) { events.set(type, callback); }, removeEventListener(type) { events.delete(type); },
    history: { pushState(state, unused, target) { visited.push({ replace: false, state, target }); url = new URL(target, url); }, replaceState(state, unused, target) { visited.push({ replace: true, state, target }); url = new URL(target, url); } } };
  return { win, sent, visited, emit: (type, event) => events.get(type)?.(event), pop(search) { url = new URL(search, url); events.get('popstate')?.(); }, receive(message, source = parent, origin = url.origin) { events.get('message')?.({ source, origin, data: { version: 1, documentId: 'navigation-document', ...message } }); } };
}

test('every experiment and task has a canonical shareable route, with catalog filters', () => {
  for (const experiment of EXPLORATIONS) {
    const route = { ...defaultNavigation(), experiment: experiment.id, stage: 'high', topic: experiment.topic, query: '声 光 & 观察', page: 2 };
    assert.deepEqual(parseNavigation(navigationSearch(route)), route);
  }
  for (const lesson of LESSONS) {
    const route = { ...defaultNavigation(), experiment: 'circuit', lesson: lesson.id };
    assert.deepEqual(parseNavigation(navigationSearch(route)), route);
  }
  assert.equal(navigationSearch(defaultNavigation()), '');
  assert.equal(parseNavigation('?lesson=divider').experiment, 'circuit');
});

test('untrusted message routes are strict; invalid public URL parts safely fall back', () => {
  for (const change of [{ experiment: 'javascript:alert(1)' }, { lesson: 'divider' }, { stage: 'bogus' }, { topic: '__proto__' }, { query: 'x'.repeat(121) }, { page: Infinity }, { page: 0 }, { page: 1.2 }]) assert.equal(normalizeNavigation({ ...defaultNavigation(), ...change }), null);
  assert.equal(normalizeNavigation([]), null);
  assert.deepEqual(parseNavigation('?experiment=bad&lesson=divider&topic=bad&page=-1'), defaultNavigation());
  assert.equal(parseNavigation('?q=' + 'x'.repeat(1000)).query.length, 120);
});

test('standalone history preserves foreign parameters, Back/Forward, and replace-only search', () => {
  const env = environment('?external=keep#anchor'), routes = [];
  const nav = createLabNavigation({ win: env.win, onRoute: route => routes.push(route) });
  const route = { ...defaultNavigation(), experiment: 'sound', topic: 'sound' };
  nav.navigate(route);
  assert.equal(env.visited.length, 1); assert.equal(env.visited[0].state, null);
  assert.equal(env.win.location.search, '?external=keep&experiment=sound&topic=sound');
  assert.equal(env.win.location.hash, '#anchor');
  nav.navigate({ ...defaultNavigation(), query: '声音' }, { replace: true });
  assert.ok(env.visited[1].replace);
  env.pop('?external=keep&experiment=sound&topic=sound'); assert.deepEqual(nav.current(), route);
  env.pop('?external=keep'); assert.equal(routes.at(-1).experiment, null);
  nav.navigate(defaultNavigation()); assert.equal(env.visited.length, 2); // restore action reapplies without another history entry
});

test('hosted navigation never changes iframe history and rejects forged or stale documents', () => {
  const env = environment('?host=steamx'), routes = [];
  const nav = createLabNavigation({ win: env.win, embedded: true, onRoute: route => routes.push(route) });
  assert.equal(env.sent[0].message.type, 'steamx-physics-navigation-ready');
  const route = { ...defaultNavigation(), experiment: 'plane-mirror' };
  env.receive({ type: 'steamx-physics-navigation-state', route }, {}, env.win.location.origin);
  env.receive({ type: 'steamx-physics-navigation-state', route }, env.win.parent, 'https://elsewhere.example');
  env.receive({ type: 'steamx-physics-navigation-state', documentId: 'old', route });
  assert.equal(nav.current().experiment, null);
  env.receive({ type: 'steamx-physics-navigation-state', route }); assert.deepEqual(nav.current(), route);
  nav.navigate({ ...route, experiment: 'sound' });
  assert.equal(env.visited.length, 0); assert.equal(env.sent.at(-1).message.type, 'steamx-physics-navigate');
  assert.equal(nav.href(route), '/playground/physics-lab?experiment=plane-mirror');
  env.receive({ type: 'steamx-physics-navigation-request' }); assert.equal(env.sent.at(-1).message.type, 'steamx-physics-navigation-ready');
});

test('queued older navigation acknowledgements do not overwrite newer search input', () => {
  const env = environment('?host=steamx'), routes = [];
  const nav = createLabNavigation({ win: env.win, embedded: true, onRoute: route => routes.push(route) });
  const one = { ...defaultNavigation(), query: '声' }, two = { ...one, query: '声音' };
  nav.navigate(one, { replace: true }); nav.navigate(two, { replace: true });
  env.receive({ type: 'steamx-physics-navigation-state', route: one });
  assert.equal(nav.current().query, '声音');
  env.receive({ type: 'steamx-physics-navigation-state', route: two });
  assert.equal(routes.length, 3);
  env.receive({ type: 'steamx-physics-navigation-state', route: defaultNavigation() });
  assert.equal(nav.current().query, '');
  nav.destroy(); env.receive({ type: 'steamx-physics-navigation-state', route: one }); assert.equal(nav.current().query, '');
});
