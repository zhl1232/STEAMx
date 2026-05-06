import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AudioLines, Binoculars, CalendarDays, Feather, MapPin } from "lucide-react";

import { SpeciesHotspotPanel } from "@/components/features/bird-observation/species-hotspot-panel";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getSpeciesBySlug } from "@/lib/api/nature-observation-data";
import { appendNatureFrom, buildNatureSubmitHref, normalizeNatureFrom } from "@/lib/utils/nature-navigation";
import { splitTaxonGroup, toSpeciesPinyinLabel } from "@/lib/utils/species-pinyin";

interface SpeciesDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function SpeciesDetailPage({ params, searchParams }: SpeciesDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const species = await getSpeciesBySlug(slug);

  if (!species) {
    notFound();
  }

  const recentObservations = species.recentObservations ?? [];
  const recentObservationCount = recentObservations.length;
  const hotspotCount = species.topLocations?.length ?? 0;
  const hasRecentObservations = recentObservationCount > 0;
  const currentPath = `/nature/species/${species.slug}`;
  const fallbackHref = normalizeNatureFrom(query.from, "/nature/species");
  const submitHref = buildNatureSubmitHref({
    topic: "birds",
    speciesId: species.id,
    from: currentPath,
  });
  const commonNamePinyin = toSpeciesPinyinLabel(species.commonName);
  const aliasesPinyin = toSpeciesPinyinLabel(species.aliasesDisplay);
  const { family, genus } = splitTaxonGroup(species.taxonGroup);
  const familyPinyin = toSpeciesPinyinLabel(family);
  const genusPinyin = toSpeciesPinyinLabel(genus);
  const taxonGroupPinyin = toSpeciesPinyinLabel(species.taxonGroup);

  return (
    <div className="page-shell pb-24 pt-0 md:pb-10 md:pt-6">
      <MobilePageHeader
        title={species.commonName}
        fallbackHref={fallbackHref}
        className="-mx-4 mb-4 md:hidden"
      />

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <div className="surface-subtle p-5 sm:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-[24px] border border-border/70 shadow-sm md:h-48 md:w-48 md:max-w-none">
                {species.coverImageUrl ? (
                  <Image
                    src={species.coverImageUrl}
                    alt={species.commonName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 192px"
                    quality={60}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.35),_transparent_45%),linear-gradient(160deg,_rgba(240,253,250,0.95),_rgba(240,249,255,0.92)_52%,_rgba(250,245,255,0.9))] p-4 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_38%),linear-gradient(160deg,_rgba(6,20,18,0.96),_rgba(11,27,34,0.94)_52%,_rgba(26,18,38,0.92))]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/70 text-emerald-700 shadow-sm dark:bg-background/10 dark:text-emerald-300">
                      <Feather className="h-6 w-6" />
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/72 px-3 py-2 backdrop-blur dark:bg-background/10">
                      <div className="text-sm font-semibold">{species.commonName}</div>
                      {commonNamePinyin ? (
                        <div className="mt-1 text-[11px] text-primary/80">{commonNamePinyin}</div>
                      ) : null}
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
                  {commonNamePinyin ? (
                    <p className="mt-2 text-sm tracking-[0.08em] text-primary/80">{commonNamePinyin}</p>
                  ) : null}
                  {species.scientificName ? (
                    <p className="mt-2 text-base italic text-muted-foreground">{species.scientificName}</p>
                  ) : null}
                  {species.aliasesDisplay ? (
                    <div className="mt-3 space-y-1 text-sm leading-6 text-muted-foreground">
                      <p>别名：{species.aliasesDisplay}</p>
                      {aliasesPinyin ? <p className="text-xs text-primary/70">{aliasesPinyin}</p> : null}
                    </div>
                  ) : null}
                </div>

                {species.taxonGroup ? (
                  <div className="rounded-2xl border border-border/80 bg-background/80 p-3 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">{species.taxonGroup}</div>
                    {taxonGroupPinyin ? <div className="text-xs text-primary/75">{taxonGroupPinyin}</div> : null}
                    {(family || genus) ? (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {family ? (
                          <span className="rounded-full border border-border/70 bg-background px-2 py-1">
                            科：{family}
                            {familyPinyin ? ` (${familyPinyin})` : ""}
                          </span>
                        ) : null}
                        {genus ? (
                          <span className="rounded-full border border-border/70 bg-background px-2 py-1">
                            属：{genus}
                            {genusPinyin ? ` (${genusPinyin})` : ""}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {species.identificationNotes ? (
              <section className="surface-subtle p-5 transition-colors hover:bg-background/80">
                <div className="flex items-center gap-2">
                  <Binoculars className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold">识别特征</h2>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{species.identificationNotes}</p>
              </section>
            ) : null}

            {species.habitatNotes ? (
              <section className="surface-subtle p-5 transition-colors hover:bg-background/80">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold">常见环境</h2>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{species.habitatNotes}</p>
              </section>
            ) : null}

            {species.seasonalityNotes ? (
              <section className="surface-subtle p-5 transition-colors hover:bg-background/80 md:col-span-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold">常见时段</h2>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{species.seasonalityNotes}</p>
              </section>
            ) : null}

            <section className="surface-subtle p-5 md:col-span-2">
              <div className="flex items-center gap-2">
                <AudioLines className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">鸟鸣音频</h2>
              </div>
              {species.audioUrl ? (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">音频按需加载，点击后开始缓冲播放。</p>
                  <div className="mt-4 rounded-xl border border-border/70 bg-background/80 p-3">
                    <audio className="w-full" controls preload="none" src={species.audioUrl}>
                      你的浏览器不支持音频播放，可直接打开链接：{species.audioUrl}
                    </audio>
                  </div>
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">最近观察记录</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                    最近记录 {recentObservationCount} 条
                  </span>
                  {hotspotCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                      热点地点 {hotspotCount} 处
                    </span>
                  ) : null}
                </div>
              </div>
              {hasRecentObservations ? (
                <div className="flex items-center gap-2">
                  <Link
                    href={submitHref}
                    className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    记录这只鸟的观察
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="mt-4 space-y-4">
              {hasRecentObservations ? (
                recentObservations.map((observation) => (
                  <Link
                    key={observation.id}
                    href={appendNatureFrom(`/nature/observations/${observation.id}`, currentPath)}
                    className="block rounded-2xl border border-border/70 bg-background/80 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/70 bg-background px-2 py-1">
                        {new Date(observation.observedAt).toLocaleString("zh-CN")}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background px-2 py-1">{observation.locationName}</span>
                      {observation.habitat ? (
                        <span className="rounded-full border border-border/70 bg-background px-2 py-1">{observation.habitat}</span>
                      ) : null}
                    </div>
                    {observation.notes ? (
                      <p className="mt-3 text-sm leading-6 text-foreground/90">{observation.notes}</p>
                    ) : null}
                    <div className="mt-3 text-xs text-primary">查看完整记录</div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 p-4">
                  <p className="text-sm text-muted-foreground">暂时还没有观察记录。</p>
                  <Link
                    href={submitHref}
                    className="mt-3 inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    记录这只鸟的观察
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
