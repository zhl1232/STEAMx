/** Query URLs used by the public observation list and its crawlable links. */
export function parseNatureObservationPage(value: string | string[] | undefined): number {
  const firstValue = Array.isArray(value) ? value[0] : value
  if (!firstValue || !/^\d+$/.test(firstValue)) return 0
  const page = Number(firstValue)
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / 12)
  return Number.isSafeInteger(page) && page <= maxPage ? page : 0
}

export function buildNatureObservationPageHref(page: number): string {
  return page > 0 ? `/nature/observations?page=${page}` : '/nature/observations'
}
