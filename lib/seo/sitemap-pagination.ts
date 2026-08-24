export const SITEMAP_PAGE_SIZE = 500;

interface SitemapPageResult<Row> {
  data: Row[] | null;
  error: unknown;
}

interface SitemapRangeQuery<Row> {
  range(from: number, to: number): PromiseLike<SitemapPageResult<Row>>;
}

interface SitemapOrderQuery<Row> {
  order(column: string, options: { ascending: boolean }): SitemapRangeQuery<Row>;
}

interface SitemapPaginationOptions {
  orderColumn?: string;
  pageSize?: number;
}

/** Read every public row without relying on Supabase's per-request row cap. */
export async function fetchAllSitemapRows<Row>(
  createQuery: () => SitemapOrderQuery<Row>,
  {
    orderColumn = "id",
    pageSize = SITEMAP_PAGE_SIZE,
  }: SitemapPaginationOptions = {},
): Promise<Row[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("Sitemap page size must be a positive integer");
  }

  const rows: Row[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery()
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}
