import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SpeciesHotspotPanel } from '@/components/features/bird-observation/species-hotspot-panel'
import { MobileBackButton } from '@/components/ui/mobile-back-button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { getSpeciesBySlug } from '@/lib/api/nature-observation-data'

interface SpeciesDetailPageProps {
  params: Promise<{ slug: string }>
}

export default async function SpeciesDetailPage({ params }: SpeciesDetailPageProps) {
  const { slug } = await params
  const species = await getSpeciesBySlug(slug)

  if (!species) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
      <MobilePageHeader
        title={species.commonName}
        fallbackHref="/explore/species"
        className="-mx-4 -mt-10 mb-4 md:hidden"
      />
      <MobileBackButton fallbackHref="/explore/species" className="hidden md:block" />

      <div className="mt-4 rounded-3xl border bg-card px-6 py-8 shadow-sm md:px-10 md:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{species.commonName}</h1>
            {species.scientificName && (
              <p className="mt-2 text-base italic text-muted-foreground">{species.scientificName}</p>
            )}
            {species.aliasesDisplay && (
              <p className="mt-2 text-sm text-muted-foreground">别名：{species.aliasesDisplay}</p>
            )}
          </div>
          {species.taxonGroup && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              {species.taxonGroup}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/bird-observation/submit?species=${species.id}`}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            我也去观察
          </Link>
          <Link
            href="/explore/observations"
            className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            查看更多观察记录
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {species.identificationNotes && (
            <section className="rounded-2xl border bg-muted/20 p-5">
              <h2 className="text-lg font-semibold">识别特征</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{species.identificationNotes}</p>
            </section>
          )}

          {species.habitatNotes && (
            <section className="rounded-2xl border bg-muted/20 p-5">
              <h2 className="text-lg font-semibold">常见环境</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{species.habitatNotes}</p>
            </section>
          )}

          {species.seasonalityNotes && (
            <section className="rounded-2xl border bg-muted/20 p-5 md:col-span-2">
              <h2 className="text-lg font-semibold">北京常见时段</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{species.seasonalityNotes}</p>
            </section>
          )}

          {species.topLocations && species.topLocations.length > 0 && (
            <SpeciesHotspotPanel locations={species.topLocations} />
          )}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border p-5 lg:col-span-2">
            <h2 className="text-xl font-semibold">如果你现在想开始观察它</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-xs text-muted-foreground">先看环境</div>
                <div className="mt-2 text-sm leading-6">{species.habitatNotes || '先从公园、湿地或身边绿地开始。'}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-xs text-muted-foreground">再看时间</div>
                <div className="mt-2 text-sm leading-6">{species.seasonalityNotes || '先选择你最容易反复到达的时间段。'}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-xs text-muted-foreground">最后开始任务</div>
                {species.relatedProjects && species.relatedProjects.length > 0 ? (
                  <Link href={`/project/${species.relatedProjects[0].id}`} className="mt-2 block text-sm font-medium text-primary hover:underline">
                    从“{species.relatedProjects[0].title}”开始
                  </Link>
                ) : (
                  <Link href={`/bird-observation/submit?species=${species.id}`} className="mt-2 block text-sm font-medium text-primary hover:underline">
                    直接记录一次观察
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border p-5">
            <h2 className="text-xl font-semibold">相关项目</h2>
            <div className="mt-4 space-y-3">
              {species.relatedProjects?.length ? (
                species.relatedProjects.map((project) => (
                  <Link key={project.id} href={`/project/${project.id}`} className="block rounded-xl border bg-muted/20 p-4 hover:bg-muted/40">
                    {project.title}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂未关联项目。</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border p-5">
            <h2 className="text-xl font-semibold">相关挑战</h2>
            <div className="mt-4 space-y-3">
              {species.relatedChallenges?.length ? (
                species.relatedChallenges.map((challenge) => (
                  <Link
                    key={challenge.id}
                    href={`/community/challenge/${challenge.id}`}
                    className="block rounded-xl border bg-muted/20 p-4 hover:bg-muted/40"
                  >
                    {challenge.title}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂未关联挑战。</p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">最近观察记录</h2>
          <div className="mt-4 space-y-4">
            {species.recentObservations?.length ? (
              species.recentObservations.map((observation) => (
                <Link
                  key={observation.id}
                  href={`/explore/observations/${observation.id}`}
                  className="block rounded-2xl border bg-muted/20 p-5 hover:bg-muted/40"
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
                  {observation.notes && (
                    <p className="mt-3 text-sm leading-6 text-foreground/90">{observation.notes}</p>
                  )}
                  <div className="mt-3 text-xs text-primary">
                    查看这条记录如何连接回任务与活动
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂时还没有公开观察记录。</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
