/** Query URLs used by both server metadata and crawlable list navigation. */
export function parseExplorePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 0;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 0;
}

export function buildExplorePageHref(params: URLSearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const key of ['q', 'category', 'subCategory', 'difficulty', 'age', 'tags', 'sortBy']) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  if (page > 0) query.set('page', String(page));
  return query.size ? `/explore?${query.toString()}` : '/explore';
}
