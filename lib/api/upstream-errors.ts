export function isTransientUpstreamError(error: unknown): boolean {
  const inspected = collectErrorStrings(error).join(' ').toLowerCase()

  if (!inspected) return false

  return [
    'connecttimeouterror',
    'connect timeout',
    'und_err_connect_timeout',
    'typeerror: fetch failed',
    'fetch failed',
    'etimedout',
    'econnreset',
    'econnrefused',
    'enotfound',
    'socket hang up',
  ].some((token) => inspected.includes(token))
}

function collectErrorStrings(error: unknown): string[] {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack ?? '']
  }

  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    return [
      typeof candidate.name === 'string' ? candidate.name : '',
      typeof candidate.message === 'string' ? candidate.message : '',
      typeof candidate.details === 'string' ? candidate.details : '',
      typeof candidate.hint === 'string' ? candidate.hint : '',
      typeof candidate.code === 'string' ? candidate.code : '',
      typeof candidate.stack === 'string' ? candidate.stack : '',
    ]
  }

  if (typeof error === 'string') {
    return [error]
  }

  return []
}
