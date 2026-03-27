import Link from 'next/link'

import { getObservations } from '@/lib/api/nature-observation-data'

interface ObservationsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ObservationsPage({ searchParams }: ObservationsPageProps) {
  const params = await searchParams
  const page = Math.max(0, parseInt(params.page || '0', 10) || 0)
  const { observations, hasMore } = await getObservations({ page, pageSize: 12 })

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
      <div className="mb-8">
        <div className="mb-3 inline-flex rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700 dark:bg-sky-950/20 dark:text-sky-300">
          自然观察 / 观察记录
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">观察记录</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          这一页是自然观察第二阶段的事实数据入口，用来承接“谁在什么时候、什么地方看到了什么”的结构化记录。
        </p>
      </div>

      <div className="space-y-4">
        {observations.map((observation) => (
          <Link
            key={observation.id}
            href={`/explore/observations/${observation.id}`}
            className="block rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{new Date(observation.observedAt).toLocaleString('zh-CN')}</span>
              <span>·</span>
              <span>{observation.locationName}</span>
              {observation.habitat && (
                <>
                  <span>·</span>
                  <span>{observation.habitat}</span>
                </>
              )}
            </div>

            {observation.species.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {observation.species.map((item) => (
                  <span key={`${observation.id}-${item.speciesId}`} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {item.commonName}
                    {item.count ? ` × ${item.count}` : ''}
                  </span>
                ))}
              </div>
            )}

            {observation.notes && (
              <p className="mt-4 text-sm leading-6 text-foreground/90">{observation.notes}</p>
            )}
          </Link>
        ))}
      </div>

      {observations.length === 0 && (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-muted-foreground">
          暂无可展示的观察记录。
        </div>
      )}

      <div className="mt-8 flex justify-end">
        {hasMore && (
          <Link
            href={`/explore/observations?page=${page + 1}`}
            className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            下一页
          </Link>
        )}
      </div>
    </div>
  )
}
