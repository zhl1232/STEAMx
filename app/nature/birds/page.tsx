import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Feather, MapPin, Sprout } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";

export default async function NatureBirdsPage() {
  const homepage = await getBirdObservationHomepageData();
  const spotlightSpecies = homepage.featuredSpecies.slice(0, 6);
  const firstSpecies = homepage.featuredSpecies[0] ?? null;
  const submitHref = firstSpecies
    ? `/nature/submit?topic=birds&species=${firstSpecies.id}`
    : "/nature/submit?topic=birds";

  return (
    <NatureShell
      title="鸟类"
      description="从能反复到达的校园、公园和社区开始，记录时间、地点、物种与行为，把鸟类观察作为自然观察频道里的第一个专题。"
      fallbackHref="/nature"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">观察提示</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">先从稳定地点开始</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              同一个地点反复记录，更容易看出季节变化、常见物种和活动模式。
            </p>
            <div className="mt-5 grid gap-3">
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                先拍一张能核对物种的照片，再补地点和备注。
              </div>
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                记录越简洁越好，先完成一条，再逐步补充细节。
              </div>
            </div>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">专题入口</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">继续去看频道公共能力</h2>
            <div className="mt-4 space-y-3">
              <Link
                href={firstSpecies ? `/nature/species/${firstSpecies.slug}` : "/nature/species?topic=birds"}
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                浏览物种档案
              </Link>
              <Link
                href="/nature/observations?topic=birds"
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                查看公开观察记录
              </Link>
            </div>
          </section>
        </>
      }
    >
      <section className="surface-panel overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50/90 via-background/95 to-sky-50/90 px-5 py-6 dark:from-emerald-950/24 dark:via-card/95 dark:to-sky-950/24 sm:px-7 sm:py-7 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Sprout className="h-3.5 w-3.5" />
            二级专题
          </div>
          <div className="mt-4 max-w-3xl">
            <p className="text-sm font-medium tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
              鸟类 · 校园 / 公园 / 社区
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">把第一条鸟类观察记录留在你熟悉的地方</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              鸟类是自然观察频道里当前已经落地的专题。你可以从提交记录开始，再回到物种页和观察流继续整理、比较和互动。
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
              href={firstSpecies ? `/nature/species/${firstSpecies.slug}` : "/nature/species?topic=birds"}
              className="inline-flex items-center justify-center rounded-full border border-border/80 bg-background/80 px-5 py-3 text-sm font-medium transition-colors hover:bg-muted/70"
            >
              浏览物种
            </Link>
          </div>

          {spotlightSpecies.length > 0 ? (
            <div className="mt-8">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Feather className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                常见物种
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {spotlightSpecies.map((species) => (
                  <Link
                    key={species.id}
                    href={`/nature/species/${species.slug}`}
                    className="inline-flex rounded-full border border-border/80 bg-background/80 px-3 py-2 text-sm transition-colors hover:bg-muted/70"
                  >
                    {species.commonName}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {homepage.recentObservations.length > 0 ? (
        <section className="surface-panel overflow-hidden p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">最近动态</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">大家最近观察到了什么</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                最近提交的公开观察记录，可继续进入详情查看图片、地点与物种信息。
              </p>
            </div>
            <Link
              href="/nature/observations?topic=birds"
              className="hidden items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:inline-flex"
            >
              查看全部
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {homepage.recentObservations.slice(0, 6).map((observation) => (
              <Link
                key={observation.id}
                href={`/nature/observations/${observation.id}`}
                className="surface-subtle block overflow-hidden transition-transform hover:-translate-y-0.5"
              >
                {observation.mediaUrls[0] ? (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={observation.mediaUrls[0]}
                      alt={observation.locationName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                ) : null}
                <div className="p-4">
                  {observation.species.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {observation.species.map((item) => (
                        <span
                          key={`${observation.id}-${item.speciesId}`}
                          className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground/85"
                        >
                          {item.commonName}
                          {item.count ? ` ×${item.count}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(observation.observedAt).toLocaleDateString("zh-CN")}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {observation.locationName}
                    </span>
                  </div>

                  {observation.notes ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/80">{observation.notes}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </NatureShell>
  );
}
