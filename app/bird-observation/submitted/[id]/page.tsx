import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MobileBackButton } from '@/components/ui/mobile-back-button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { getBirdObservationHomepageData, getCuratedProjectSpecies, getObservationById } from '@/lib/api/nature-observation-data'

interface ObservationSubmittedPageProps {
  params: Promise<{ id: string }>
}

export default async function ObservationSubmittedPage({ params }: ObservationSubmittedPageProps) {
  const { id } = await params
  const observation = await getObservationById(id)

  if (!observation) {
    notFound()
  }

  const primarySpecies = observation.species[0] ?? null
  const homepage = await getBirdObservationHomepageData()
  const projectSpecies = observation.project
    ? await getCuratedProjectSpecies(observation.project.id)
    : []
  const recommendedNextSpecies =
    projectSpecies.find((species) => species.slug !== primarySpecies?.speciesSlug)
    || homepage.featuredSpecies.find((species) => species.slug !== primarySpecies?.speciesSlug)
    || null

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
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">你的第一条观察已经保存</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          接下来可以继续回看这条记录对应的物种、任务和活动，把第一次观察自然地接到下一步。
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
                <span key={`${observation.id}-${item.speciesId}`} className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {item.commonName}
                  {item.count ? ` × ${item.count}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {recommendedNextSpecies && (
            <Link
              href={`/explore/species/${recommendedNextSpecies.slug}`}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:col-span-2"
            >
              <div className="text-xs text-muted-foreground">推荐下一条</div>
              <h2 className="mt-2 text-xl font-semibold">下一次可以试着观察 {recommendedNextSpecies.commonName}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                把第一次记录完成后，最好的继续方式不是重新犹豫，而是立刻去看下一种你也可能遇到的鸟。
              </p>
            </Link>
          )}

          {primarySpecies?.speciesSlug && (
            <Link
              href={`/explore/species/${primarySpecies.speciesSlug}`}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs text-muted-foreground">下一步 1</div>
              <h2 className="mt-2 text-xl font-semibold">去认识这种鸟</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                看看它通常出现在哪里、最近还有谁观察到了它，以及适合从哪个任务开始继续观察。
              </p>
            </Link>
          )}

          {observation.project && (
            <Link
              href={`/project/${observation.project.id}`}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs text-muted-foreground">下一步 2</div>
              <h2 className="mt-2 text-xl font-semibold">回到这个任务</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                继续完成任务步骤，看看这个项目还推荐你观察哪些鸟，以及如何把下一条记录做得更完整。
              </p>
            </Link>
          )}

          {observation.challenge && (
            <Link
              href={`/community/challenge/${observation.challenge.id}`}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs text-muted-foreground">下一步 3</div>
              <h2 className="mt-2 text-xl font-semibold">回到活动</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                看看这个活动还推荐哪些任务和物种，把单次观察放回更完整的活动路径里。
              </p>
            </Link>
          )}

          <Link
            href="/bird-observation/submit"
            className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs text-muted-foreground">下一步 4</div>
            <h2 className="mt-2 text-xl font-semibold">继续记录下一条观察</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              一次记录只是开始，连续记录几次之后，你会更容易看出地点、物种和行为之间的差别。
            </p>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/explore/observations/${observation.id}`}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            查看这条记录详情
          </Link>
          <Link
            href="/bird-observation"
            className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            返回自然观察频道
          </Link>
        </div>
      </div>
    </div>
  )
}
