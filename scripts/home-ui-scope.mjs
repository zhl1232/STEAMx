import { createHash } from 'node:crypto';

// Reviewed at 602c6efa: homepage-only consumers. Import preambles are pinned, not
// merely compared to each other: a previously changed graph cannot silently qualify.
const HOME_SOURCES = new Map([
  ['components/home/home-showcase.tsx', {
    // Structure reviewed again at 245edced; imports and homepage-only consumers are unchanged.
    shape: '76bdf6b676ef8cc7e317caa57af585d353b22264394b1e75f14952919b82d835', boundary: 'const heroImage =', prefix: '41d4853169745db37c0b8e5957c655ac5394b891c326903649da664c58e841bd',
  }],
  ['components/home/mobile-shortcut-carousel.tsx', {
    shape: '81dae3bcb7a9ae4b4f9d118504544405cc838cf39e1e60a3a3ea559c8095b941', boundary: 'interface MobileShortcutCarouselProps', prefix: '12809eb3fd7fe3afb4c39d6d2cf012cb859cbfc98ea5893595572a4bbe7cc8d9',
  }],
]);
export const HOME_PATHS = new Set(HOME_SOURCES.keys());

// Permit only existing quoted presentation attributes and existing Chinese JSX
// text nodes. Everything else, including imports, JSX structure, URLs, handlers,
// component props and program logic, must match the reviewed source fingerprint.
// Deliberately rejects many harmless changes; expanding this requires review.
export function presentationShape(source) {
  return source
    .replace(/\b(className|aria-label|alt|title)="[^"<>{}]*"/g, '$1="__DISPLAY__"')
    .replace(/>(\s*[\u3400-\u9fff][^<>{}]*?)</g, '>__COPY__<');
}

export function hasReviewedDependencies(path, source) {
  const policy = HOME_SOURCES.get(path);
  if (!policy || typeof source !== 'string') return false;
  const end = source.indexOf(policy.boundary);
  if (end < 0 || createHash('sha256').update(source.slice(0, end)).digest('hex') !== policy.prefix) return false;
  if (createHash('sha256').update(presentationShape(source)).digest('hex') !== policy.shape) return false;
  const body = source.slice(end);
  // Conservative rejection includes comments/strings. No new imports/re-exports,
  // escaped identifiers, dynamic evaluation, network or worker loaders in this profile.
  return !/\b(?:import|require|eval|Function|globalThis|Reflect|constructor|Worker|SharedWorker|importScripts|serviceWorker|fetch|XMLHttpRequest|WebSocket|document|dangerouslySetInnerHTML)\b|\\(?:u|x)|\bexport\s*(?:type\s*)?(?:\*|\{)|\bwindow\s*\[|<(?:script|iframe|object|embed)\b|\burl\s*\(|javascript:|data:/.test(body);
}

export function isReviewedHomeChange(change, before, after, git) {
  if (!HOME_PATHS.has(change.path) || change.oldMode !== '100644' || change.newMode !== '100644') return false;
  // Read both immutable trees; never infer imports from the working directory alone.
  return [before, after].every(ref => hasReviewedDependencies(change.path,
    git(['show', `${ref}:${change.path}`])));
}
