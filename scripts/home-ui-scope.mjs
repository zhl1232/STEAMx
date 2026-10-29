import { createHash } from 'node:crypto';

// Reviewed at 602c6efa: homepage-only consumers. Import preambles are pinned, not
// merely compared to each other: a previously changed graph cannot silently qualify.
const HOME_SOURCES = new Map([
  ['components/home/home-showcase.tsx', {
    // Re-reviewed after removing category counts and reusing the original hero image; still homepage-only.
    shape: 'ee7f87152dc66d53211f71a96715a1ff1519653c37613d8136a5c926ccc2ce6d', boundary: 'const heroImage =', prefix: 'a02e8a4e2288362fad0735ac4b5e93995f4a526c81ce15084fe03ba017377561',
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
