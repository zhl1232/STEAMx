/** Development tools are enabled by the Next.js mode, never by a dev hostname. */
export function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development'
}
