import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MobileBackButton } from '@/components/ui/mobile-back-button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { getObservationById } from '@/lib/api/nature-observation-data'

interface ObservationSubmittedPageProps {
  params: Promise<{ id: string }>
}

export default async function ObservationSubmittedPage({ params }: ObservationSubmittedPageProps) {
  const { id } = await params
  const observation = await getObservationById(id)

  if (!observation) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 md:py-14">
      <MobilePageHeader
        title="观察记录已保存"
        fallbackHref="/bird-observation"
        className="-mx-4 -mt-10 mb-4 md:hidden"
      />
      <MobileBackButton fallbackHref="/bird-observation" className="hidden md:block" />

      <div className="mt-4 rounded-3xl border bg-card px-6 py-8 shadow-sm md:px-10 md:py-10">
        <div className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
          记录已完成
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">你的观察已经保存</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          可在详情页查看完整信息与互动，或继续提交下一条记录。
        </p>

        <div className="mt-8 rounded-2xl border bg-muted/20 p-5">
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
            <div className="mt-3 flex flex-wrap gap-2">
              {observation.species.map((item) => (
                <span
                  key={`${observation.id}-${item.speciesId}`}
                  className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {item.commonName}
                  {item.count ? ` × ${item.count}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/explore/observations/${observation.id}`}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            查看这条记录详情
          </Link>
          <Link
            href="/bird-observation/submit"
            className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            继续记录下一条
          </Link>
        </div>
      </div>
    </div>
  )
}
