import Link from 'next/link'

import { getSpeciesList } from '@/lib/api/nature-observation-data'

interface SpeciesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SpeciesPage({ searchParams }: SpeciesPageProps) {
  const params = await searchParams
  const page = Math.max(0, parseInt(params.page || '0', 10) || 0)
  const query = params.q || undefined
  const { species, hasMore } = await getSpeciesList({ query, page, pageSize: 12 })

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
      <div className="mb-8">
        <div className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
          自然观察 / 物种
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">鸟类物种</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          这一页是自然观察第二阶段的物种入口骨架，用来承接常见鸟种的知识信息、最近观察记录，以及与项目和挑战的反查关系。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {species.map((item) => (
          <Link
            key={item.id}
            href={`/explore/species/${item.slug}`}
            className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{item.commonName}</h2>
                {item.scientificName && (
                  <p className="mt-1 text-sm italic text-muted-foreground">{item.scientificName}</p>
                )}
              </div>
              {item.taxonGroup && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {item.taxonGroup}
                </span>
              )}
            </div>

            {item.habitatNotes && (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.habitatNotes}</p>
            )}

            {item.seasonalityNotes && (
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                北京时段：{item.seasonalityNotes}
              </p>
            )}
          </Link>
        ))}
      </div>

      {species.length === 0 && (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-muted-foreground">
          暂无可展示的物种数据。
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <div />
        {hasMore && (
          <Link
            href={`/explore/species?page=${page + 1}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
            className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            下一页
          </Link>
        )}
      </div>
    </div>
  )
}
