// Shared, dependency-free drawing and input helpers for portable experiments.
export const G = 9.81;
export const control = (key, label, min, max, step, value, unit = '') => ({ key, label, min, max, step, value, unit });
export const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const fmt = (value, digits = 2) => value === null || !Number.isFinite(value) ? '—' : Math.abs(value) >= 1e5 ? value.toExponential(2) : value.toFixed(digits);
export const metric = (label, value, unit = '') => ({ label, value: typeof value === 'number' || value === null ? fmt(value) : value, unit });
export const text = (x, y, value, className = 'diagram-label') => `<text x="${x}" y="${y}" class="${className}">${escapeText(value)}</text>`;
export const line = (x1, y1, x2, y2, color = 'var(--diagram-stroke)', width = 3, dash = '') => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
export function arrow(x, y, dx, dy, color = 'var(--green)') {
  if (Math.hypot(dx, dy) < 1e-8) return '';
  const angle = Math.atan2(dy, dx), endX = x + dx, endY = y + dy;
  return line(x, y, endX, endY, color) + `<path d="M${endX - 8 * Math.cos(angle - .45)} ${endY - 8 * Math.sin(angle - .45)}L${endX} ${endY}L${endX - 8 * Math.cos(angle + .45)} ${endY - 8 * Math.sin(angle + .45)}" fill="none" stroke="${color}" stroke-width="3"/>`;
}
export const circle = (x, y, radius, fill = 'var(--surface-muted)', stroke = 'var(--diagram-stroke)') => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
export const rect = (x, y, width, height, fill = 'var(--surface-muted)') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${fill}" stroke="var(--line-strong)" stroke-width="2"/>`;
export function plot(fn, { x = 80, y = 235, width = 640, scale = 100, color = 'var(--green)' } = {}) {
  return `<polyline points="${Array.from({ length: 161 }, (_, i) => `${x + i / 160 * width},${y - fn(i / 160) * scale}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3"/>`;
}
