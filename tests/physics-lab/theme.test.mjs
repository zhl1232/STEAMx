import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../../public/physics-lab/theme.js', import.meta.url), 'utf8');

function setup({ embedded = true, sameOrigin = true, dark = false, theme = 'dark' } = {}) {
  const properties = new Map();
  const root = { dataset: {}, style: {
    setProperty: (key, value) => properties.set(key, value),
    removeProperty: key => properties.delete(key),
  } };
  const classes = new Set(theme === 'black-gold' ? ['dark', 'black-gold'] : [theme]);
  const hostRoot = { classList: { contains: name => classes.has(name) } };
  const palette = new Map([['--app-canvas', '214 46% 7%'], ['--brand-blue', '209 92% 70%']]);
  const listeners = new Map();
  const media = { matches: dark, addEventListener: (name, fn) => listeners.set(`media:${name}`, fn), removeEventListener: name => listeners.delete(`media:${name}`) };
  const window = {
    location: { origin: 'https://lab.example', search: embedded ? '?host=steamx' : '' },
    matchMedia: () => media,
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  window.parent = embedded ? {
    location: { get origin() { if (!sameOrigin) throw new Error('cross-origin'); return window.location.origin; } },
    document: { documentElement: hostRoot, body: {} },
    getComputedStyle: () => ({ getPropertyValue: key => palette.get(key) || '', fontFamily: '"PingFang SC", sans-serif' }),
  } : window;
  let observer;
  class MutationObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target, options) { this.target = target; this.options = options; this.active = true; }
    disconnect() { this.active = false; }
  }
  runInNewContext(source, { window, document: { documentElement: root }, MutationObserver, URLSearchParams });
  return { root, properties, classes, palette, media, listeners, observer, hostRoot };
}

test('embedded theme is ready before body/app startup and uses main-site tokens', () => {
  const env = setup({ dark: false });
  assert.equal(env.root.dataset.theme, 'dark');
  assert.equal(env.root.style.colorScheme, 'dark');
  assert.equal(env.properties.get('--bg'), 'hsl(214 46% 7%)');
  assert.equal(env.properties.get('--green'), 'hsl(209 92% 70%)');
  assert.equal(env.properties.get('--lab-font'), '"PingFang SC", sans-serif');
  assert.equal(env.observer.target, env.hostRoot);
});

test('parent theme switches update colors including black gold and remove missing overrides', () => {
  const env = setup();
  env.classes.add('black-gold');
  env.palette.set('--brand-blue', '43 100% 50%');
  env.observer.callback();
  assert.equal(env.root.dataset.theme, 'black-gold');
  assert.equal(env.properties.get('--green'), 'hsl(43 100% 50%)');
  env.classes.clear();
  env.classes.add('light');
  env.palette.delete('--app-canvas');
  env.observer.callback();
  assert.equal(env.root.dataset.theme, 'light');
  assert.equal(env.root.style.colorScheme, 'light');
  assert.equal(env.properties.has('--bg'), false);
});

test('standalone follows system changes without needing local storage or host access', () => {
  const env = setup({ embedded: false, dark: true });
  assert.equal(env.root.dataset.theme, 'dark');
  assert.equal(env.properties.size, 0);
  env.media.matches = false;
  env.listeners.get('media:change')();
  assert.equal(env.root.dataset.theme, 'light');
});

test('foreign embeds cannot supply host colors', () => {
  const env = setup({ sameOrigin: false, dark: false });
  assert.equal(env.root.dataset.theme, 'light');
  assert.equal(env.properties.size, 0);
  assert.equal(env.observer, undefined);
});

test('page lifecycle disconnects and restores host observation for cached pages', () => {
  const env = setup();
  env.listeners.get('pagehide')();
  assert.equal(env.observer.active, false);
  env.classes.clear();
  env.listeners.get('pageshow')();
  assert.equal(env.observer.active, true);
  assert.equal(env.root.dataset.theme, 'light');
});
