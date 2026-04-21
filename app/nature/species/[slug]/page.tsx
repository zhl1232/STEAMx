import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Feather } from "lucide-react";

import { SpeciesHotspotPanel } from "@/components/features/bird-observation/species-hotspot-panel";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getSpeciesBySlug } from "@/lib/api/nature-observation-data";

interface SpeciesDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SpeciesDetailPage({ params }: SpeciesDetailPageProps) {
  const { slug } = await params;
  const species = await getSpeciesBySlug(slug);

  if (!species) {
    notFound();
  }

  return (
    <div className="page-shell pt-6 pb-24 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title={species.commonName} fallbackHref="/nature/species" />
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-[24px] border border-border/70 md:h-48 md:w-48">
              {species.coverImageUrl ? (
                <Image
                  src={species.coverImageUrl}
                  alt={species.commonName}
                  fill
                  className="object-cover"
                  sizes="192px"
                  quality={60}
                />
              ) : (
                <div className="flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.35),_transparent_45%),linear-gradient(160deg,_rgba(240,253,250,0.95),_rgba(240,249,255,0.92)_52%,_rgba(250,245,255,0.9))] p-4 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_38%),linear-gradient(160deg,_rgba(6,20,18,0.96),_rgba(11,27,34,0.94)_52%,_rgba(26,18,38,0.92))]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/70 text-emerald-700 shadow-sm dark:bg-background/10 dark:text-emerald-300">
                    <Feather className="h-6 w-6" />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/72 px-3 py-2 backdrop-blur dark:bg-background/10">
                    <div className="text-sm font-semibold">{species.commonName}</div>
                    {species.scientificName ? (
                      <div className="mt-1 text-[11px] italic leading-5 text-muted-foreground">{species.scientificName}</div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="section-kicker">物种档案</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{species.commonName}</h1>
                {species.scientificName ? (
                  <p className="mt-2 text-base italic text-muted-foreground">{species.scientificName}</p>
                ) : null}
                {species.aliasesDisplay ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">别名：{species.aliasesDisplay}</p>
                ) : null}
              </div>

              {species.taxonGroup ? (
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm font-medium text-muted-foreground">
                  {species.taxonGroup}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/nature/submit?species=${species.id}`}
              className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              我也去观察
            </Link>
            <Link
              href="/nature/observations"
              className="inline-flex items-center rounded-full border border-border/80 bg-background/80 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted/70"
            >
              查看更多观察记录
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {species.identificationNotes ? (
              <section className="surface-subtle p-5">
                <h2 className="text-lg font-semibold">识别特征</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{species.identificationNotes}</p>
              </section>
            ) : null}

            {species.habitatNotes ? (
              <section className="surface-subtle p-5">
                <h2 className="text-lg font-semibold">常见环境</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{species.habitatNotes}</p>
              </section>
            ) : null}

            {species.seasonalityNotes ? (
              <section className="surface-subtle p-5 md:col-span-2">
                <h2 className="text-lg font-semibold">常见时段</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{species.seasonalityNotes}</p>
              </section>
            ) : null}

            <section className="surface-subtle p-5 md:col-span-2">
              <h2 className="text-lg font-semibold">鸟鸣音频</h2>
              {species.audioUrl ? (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">音频按需加载，点击后开始缓冲播放。</p>
                  <audio className="mt-4 w-full" controls preload="none" src={species.audioUrl}>
                    你的浏览器不支持音频播放，可直接打开链接：{species.audioUrl}
                  </audio>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">暂未收录该物种音频，后续会持续补充。</p>
              )}
            </section>

            {species.topLocations && species.topLocations.length > 0 ? (
              <SpeciesHotspotPanel locations={species.topLocations} />
            ) : null}
          </div>

          <section className="mt-10 surface-subtle p-5">
            <h2 className="text-xl font-semibold">如果你现在想开始观察它</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-xs text-muted-foreground">先看环境</div>
                <div className="mt-2 text-sm leading-6">{species.habitatNotes || "先从公园、湿地或身边绿地开始。"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-xs text-muted-foreground">再看时间</div>
                <div className="mt-2 text-sm leading-6">{species.seasonalityNotes || "先选择你最容易反复到达的时间段。"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-xs text-muted-foreground">最后去记录</div>
                <Link href={`/nature/submit?species=${species.id}`} className="mt-2 block text-sm font-medium text-primary hover:underline">
                  直接记录一次观察
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-10 surface-subtle p-5">
            <h2 className="text-xl font-semibold">最近观察记录</h2>
            <div className="mt-4 space-y-4">
              {species.recentObservations?.length ? (
                species.recentObservations.map((observation) => (
                  <Link
                    key={observation.id}
                    href={`/nature/observations/${observation.id}`}
                    className="block rounded-2xl border border-border/70 bg-background/80 p-5 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(observation.observedAt).toLocaleString("zh-CN")}</span>
                      <span>·</span>
                      <span>{observation.locationName}</span>
                      {observation.habitat ? (
                        <>
                          <span>·</span>
                          <span>{observation.habitat}</span>
                        </>
                      ) : null}
                    </div>
                    {observation.notes ? (
                      <p className="mt-3 text-sm leading-6 text-foreground/90">{observation.notes}</p>
                    ) : null}
                    <div className="mt-3 text-xs text-primary">查看完整记录</div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂时还没有公开观察记录。</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
