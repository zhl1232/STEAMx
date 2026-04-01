import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Feather, Sprout } from 'lucide-react'

import { getBirdObservationHomepageData } from '@/lib/api/nature-observation-data'

export default async function BirdObservationPage() {
  const homepage = await getBirdObservationHomepageData()
  const spotlightSpecies = homepage.featuredSpecies.slice(0, 6)
  const firstSpecies = homepage.featuredSpecies[0] ?? null
  const submitHref = firstSpecies
    ? `/bird-observation/submit?species=${firstSpecies.id}`
    : '/bird-observation/submit'

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#ecfdf5,transparent_40%),radial-gradient(circle_at_bottom_right,#eff6ff,transparent_35%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.5),rgba(2,6,23,0))]" />
      <div className="pointer-events-none absolute left-[-8rem] top-20 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute right-[-6rem] top-32 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />

      <div className="container relative mx-auto max-w-5xl px-4 py-6 pb-14 sm:py-8 md:py-10">
        <section className="rounded-[2rem] border border-white/70 bg-white/88 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-card/88">
          <div className="px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Sprout className="h-3.5 w-3.5" />
              自然观察
            </div>

            <div className="mt-5 max-w-3xl">
              <p className="text-sm font-medium tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
                北京 · 校园 / 公园 / 社区
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                北京春季观鸟
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                从能反复到达的地方开始，记下时间、地点、物种与行为，完成你的观察记录。
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={submitHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
              >
                开始记录
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={firstSpecies ? `/explore/species/${firstSpecies.slug}` : '/explore/species'}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50/70 px-5 py-3 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              >
                浏览物种
              </Link>
            </div>

            {spotlightSpecies.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Feather className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  常见物种
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {spotlightSpecies.map((species) => (
                    <Link
                      key={species.id}
                      href={`/explore/species/${species.slug}`}
                      className="inline-flex rounded-full border border-emerald-200/80 bg-white/80 px-3 py-2 text-sm text-foreground transition-colors hover:bg-emerald-50 dark:border-emerald-900 dark:bg-background/40 dark:hover:bg-emerald-950/20"
                    >
                      {species.commonName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {homepage.recentObservations.length > 0 && (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
                  最近动态
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">大家最近观察到了什么</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  最近提交的公开观察记录，可点进详情继续互动。
                </p>
              </div>
              <Link
                href="/explore/observations"
                className="hidden text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 sm:inline-flex sm:items-center sm:gap-2 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                查看全部
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {homepage.recentObservations.slice(0, 6).map((observation) => (
                <Link
                  key={observation.id}
                  href={`/explore/observations/${observation.id}`}
                  className="group rounded-[1.5rem] border border-border/70 bg-white/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-card/80"
                >
                  {observation.mediaUrls[0] && (
                    <div className="relative aspect-[16/10] overflow-hidden rounded-t-[1.5rem]">
                      <Image
                        src={observation.mediaUrls[0]}
                        alt={observation.locationName}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    {observation.species.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {observation.species.map((item) => (
                          <span
                            key={`${observation.id}-${item.speciesId}`}
                            className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                          >
                            {item.commonName}
                            {item.count ? ` ×${item.count}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(observation.observedAt).toLocaleDateString('zh-CN')}</span>
                      <span>·</span>
                      <span>{observation.locationName}</span>
                    </div>
                    {observation.notes && (
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-foreground/80">{observation.notes}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
