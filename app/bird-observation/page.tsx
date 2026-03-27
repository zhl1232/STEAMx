import Link from 'next/link'
import { ArrowRight, Compass, Feather, MapPin, Sprout } from 'lucide-react'

import { getBirdObservationHomepageData } from '@/lib/api/nature-observation-data'
import { birdObservationLocationPresets, birdObservationResources, birdObservationTopicCopy } from '@/lib/bird-observation-content'

const ALL_BIRD_PROJECTS_HREF =
  '/explore?category=%E7%A7%91%E5%AD%A6&subCategory=%E5%8A%A8%E7%89%A9%E8%A7%82%E5%AF%9F&tags=%E9%B8%9F%E7%B1%BB'

function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  eyebrow: string
  title: string
  description?: string
  href?: string
  cta?: string
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {href && cta ? (
        <Link
          href={href}
          className="hidden text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 sm:inline-flex sm:items-center sm:gap-2 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  )
}

export default async function BirdObservationPage() {
  const homepage = await getBirdObservationHomepageData()

  const firstProject = homepage.featuredProjects[0] ?? null
  const firstSpecies = homepage.featuredSpecies[0] ?? null
  const introGuide = birdObservationResources[0] ?? null
  const featuredProjectsPreview = homepage.featuredProjects.slice(0, 3)
  const spotlightSpecies = homepage.featuredSpecies.slice(0, 4)
  const quickLocations = birdObservationLocationPresets.slice(0, 3)
  const firstLocation = quickLocations[0] ?? null

  const primaryHref = firstProject
    ? `/project/${firstProject.id}`
    : homepage.featuredChallenge
      ? `/community/challenge/${homepage.featuredChallenge.id}`
      : ALL_BIRD_PROJECTS_HREF

  const guidedSubmitHref =
    firstProject && firstSpecies
      ? `/bird-observation/submit?project=${firstProject.id}&species=${firstSpecies.id}`
      : '/bird-observation/submit'

  const starterRoute = [
    {
      step: '01',
      label: '先选一个任务开始',
      title: firstProject ? firstProject.title : '先从推荐任务开始',
      description: '第一次只需要决定“我先做哪一个任务”，不用把所有入口都看一遍。',
      href: primaryHref,
      cta: '打开任务',
    },
    {
      step: '02',
      label: '再选一个方便重复去的地点',
      title: firstLocation ? firstLocation.name : '先看推荐地点',
      description: firstLocation ? firstLocation.description : '优先选择你能反复到达、能安静停留的观察点。',
      href: '/bird-observation/resources/beijing-locations',
      cta: '看地点提示',
    },
    {
      step: '03',
      label: '先认住一种常见鸟',
      title: firstSpecies ? firstSpecies.commonName : '先从常见鸟开始',
      description: '先把一种你最容易反复看到的鸟认稳定，识别和记录都会轻松很多。',
      href: firstSpecies ? `/explore/species/${firstSpecies.slug}` : '/explore/species',
      cta: '看这只鸟',
    },
    {
      step: '04',
      label: '最后补一条完整记录',
      title: '把时间、地点、物种、数量写完整',
      description: '不需要一开始写很多，只要把这次看到的事实记录完整就够了。',
      href: guidedSubmitHref,
      cta: '去写记录',
    },
  ]

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
              {birdObservationTopicCopy.channelTitle}
            </div>

            <div className="mt-5 max-w-3xl">
              <p className="text-sm font-medium tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
                北京 · 校园 / 公园 / 社区
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {birdObservationTopicCopy.topicTitle}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {birdObservationTopicCopy.topicSubtitle}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#starter-route"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
              >
                {birdObservationTopicCopy.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={firstSpecies ? `/explore/species/${firstSpecies.slug}` : '/explore/species'}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50/70 px-5 py-3 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              >
                {birdObservationTopicCopy.secondaryCta}
              </Link>
              <Link
                href={introGuide ? `/bird-observation/resources/${introGuide.slug}` : '/bird-observation/resources/birding-basics'}
                className="inline-flex items-center justify-center rounded-full border border-border/80 bg-white/70 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white dark:bg-card/60 dark:hover:bg-card"
              >
                先看入门指南
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/20">
                适合第一次观鸟的人
              </span>
              <span className="rounded-full border border-border/80 bg-white/80 px-3 py-1.5 dark:bg-background/40">
                一次先完成一条记录
              </span>
              <span className="rounded-full border border-border/80 bg-white/80 px-3 py-1.5 dark:bg-background/40">
                不必跑远，先从身边开始
              </span>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/80 p-4 shadow-sm dark:border-emerald-950 dark:from-card dark:to-emerald-950/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">这期先从这些任务开始</span>
                  <Compass className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div className="mt-3 space-y-2">
                  {featuredProjectsPreview.length > 0 ? (
                    featuredProjectsPreview.map((project) => (
                      <Link
                        key={project.id}
                        href={`/project/${project.id}`}
                        className="block rounded-xl border border-emerald-100/80 bg-white/80 px-3 py-2 text-sm text-foreground transition-colors hover:bg-emerald-50 dark:border-emerald-950 dark:bg-background/40 dark:hover:bg-emerald-950/20"
                      >
                        {project.title}
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      暂无推荐任务
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/80 p-4 shadow-sm dark:border-emerald-950 dark:from-card dark:to-emerald-950/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">先去这些容易到达的地方</span>
                  <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div className="mt-3 space-y-2">
                  {quickLocations.length > 0 ? (
                    quickLocations.map((location) => (
                      <Link
                        key={location.id}
                        href="/bird-observation/resources/beijing-locations"
                        className="block rounded-xl border border-emerald-100/80 bg-white/80 px-3 py-2 transition-colors hover:bg-emerald-50 dark:border-emerald-950 dark:bg-background/40 dark:hover:bg-emerald-950/20"
                      >
                        <div className="text-sm text-foreground">{location.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{location.description}</div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      暂无推荐地点
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/80 p-4 shadow-sm dark:border-emerald-950 dark:from-card dark:to-emerald-950/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">先认识这些常见鸟</span>
                  <Feather className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {spotlightSpecies.length > 0 ? (
                    spotlightSpecies.map((species) => (
                      <Link
                        key={species.id}
                        href={`/explore/species/${species.slug}`}
                        className="inline-flex rounded-full border border-emerald-200/80 bg-white/80 px-3 py-2 text-sm text-foreground transition-colors hover:bg-emerald-50 dark:border-emerald-900 dark:bg-background/40 dark:hover:bg-emerald-950/20"
                      >
                        {species.commonName}
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      暂无常见鸟推荐
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              从上面三栏里各选一个，你的第一次观察就有了一个足够清晰的起点。
            </div>
          </div>
        </section>

        <section id="starter-route" className="mt-10">
          <SectionHeading
            eyebrow="新手路径"
            title="第一次来，按这条路径走就够了"
            description="先选任务，再选地点，再认住一种常见鸟，最后提交记录。每一步都尽量只做一个决定。"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {starterRoute.map((item) => (
              <div
                key={item.step}
                className="rounded-[1.5rem] border border-border/70 bg-white/85 p-5 shadow-sm dark:bg-card/80"
              >
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">第 {item.step} 步</div>
                <div className="mt-4 text-sm font-medium text-muted-foreground">{item.label}</div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <Link
                  href={item.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  {item.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-border/70 pt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {introGuide ? (
              <Link href={`/bird-observation/resources/${introGuide.slug}`} className="hover:text-foreground">
                入门指南
              </Link>
            ) : null}
            <Link href="/bird-observation/resources/beijing-locations" className="hover:text-foreground">
              地点建议
            </Link>
            <Link href="/bird-observation/resources/common-waterbirds" className="hover:text-foreground">
              常见水鸟
            </Link>
            <Link href="/bird-observation/resources/record-template" className="hover:text-foreground">
              记录模板
            </Link>
            <Link href={guidedSubmitHref} className="hover:text-foreground">
              提交记录
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
