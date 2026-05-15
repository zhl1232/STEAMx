import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, Leaf, MapPin, Trees } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { ObservationPhotoFrame } from "@/components/features/bird-observation/observation-photo-frame";
import { TopicHotspotPanel } from "@/components/features/bird-observation/topic-hotspot-panel";
import {
  getTreeObservationCategoryStats,
  getTreeObservationFeaturedSpecies,
  getTreeObservationHotspots,
  getTreeObservationRecentObservations,
} from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { appendNatureFrom, buildNatureSubmitHref } from "@/lib/utils/nature-navigation";

const FEATURED_SPECIES_LIMIT = 6;
const HOTSPOT_DISPLAY_LIMIT = 6;
const OBSERVATION_DISPLAY_LIMIT = 12;
const TOPIC_KEY = "plants";
const PAGE_HREF = "/nature/trees";

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

export const metadata: Metadata = buildPageMetadata({
  title: "树木观察",
  description: "查看本地常见树木物种档案，记录树叶、树皮、花果和物候变化，把身边树木观察沉淀成可追踪的数据。",
  path: PAGE_HREF,
  keywords: ["树木观察", "植物观察", "树木识别", "自然观察", "物种记录"],
});

export const dynamic = "force-dynamic";

export default async function NatureTreesPage() {
  const [categoryStats, spotlightSpecies, recentObservations, hotspots] = await Promise.all([
    getTreeObservationCategoryStats(),
    getTreeObservationFeaturedSpecies(FEATURED_SPECIES_LIMIT),
    getTreeObservationRecentObservations(OBSERVATION_DISPLAY_LIMIT),
    getTreeObservationHotspots(HOTSPOT_DISPLAY_LIMIT),
  ]);

  const submitHref = buildNatureSubmitHref({
    topic: TOPIC_KEY,
    from: PAGE_HREF,
  });
  const displayObservations = recentObservations.slice(0, OBSERVATION_DISPLAY_LIMIT);

  return (
    <NatureShell
      title="树木"
      description="查看树木物种档案，记录树叶、树皮、花果和物候变化。"
      fallbackHref="/nature"
      variant="wide"
      showDesktopIntro={false}
      className="max-w-none bg-[#f6f8ef] text-[#1c2418] dark:bg-[#0b1208] dark:text-[#f1f7ec]"
      mainClassName="space-y-6 md:space-y-7"
    >
      <section className="surface-panel relative overflow-hidden p-0">
        <div className="grid min-h-[320px] gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:min-h-[380px]">
          <div className="relative min-h-[320px] xl:min-h-[380px]">
            <Image
              src="/trees/images/ginkgo-biloba-1.jpg"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1840px) 1356px, (min-width: 1024px) calc(100vw - 30rem), 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#f6f8ef]/96 via-[#f6f8ef]/70 to-[#f6f8ef]/10 dark:from-[#0b1208]/96 dark:via-[#0b1208]/68 dark:to-[#0b1208]/12" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#f6f8ef]/82 via-[#f6f8ef]/48 to-transparent lg:hidden dark:from-[#0b1208]/84 dark:via-[#0b1208]/50" />
            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 lg:p-8">
              <p className="section-kicker">树木分类</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                认识身边每一棵树
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/72 md:text-base">
                从叶形、树皮、花果和季节变化开始，把校园、公园和社区里的树木变成可回看的观察档案。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={submitHref}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#26733f] px-5 text-[15px] font-extrabold text-white shadow-[0_22px_48px_-20px_rgba(38,115,63,0.95),0_0_0_1px_rgba(255,255,255,0.24)_inset] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1d6033] hover:shadow-[0_26px_58px_-22px_rgba(38,115,63,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1208] active:scale-[0.98] dark:bg-[#78bd63] dark:text-[#071206] dark:hover:bg-[#94da7e] md:min-h-[56px] md:px-8 md:text-[17px]"
                >
                  <Camera className="h-5 w-5" />
                  发布观察
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-border/60 bg-background/76 backdrop-blur-sm lg:grid-cols-1 lg:border-l lg:border-t-0">
            {[
              { icon: Trees, label: "树木物种", value: formatCount(categoryStats.speciesCount) },
              { icon: Camera, label: "公开记录", value: formatCount(categoryStats.observationCount) },
              { icon: MapPin, label: "观察地点", value: formatCount(categoryStats.locationCount) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex min-w-0 flex-col gap-2 border-r border-border/60 p-4 last:border-r-0 lg:flex-row lg:items-center lg:gap-3 lg:border-b lg:border-r-0 lg:p-5 lg:last:border-b-0"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-semibold tabular-nums">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden p-5 sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">树木图鉴</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">常见树木物种</h2>
          </div>
          <Link
            href="/nature/species?topic=plants"
            className="hidden items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:inline-flex"
          >
            查看全部
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {spotlightSpecies.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {spotlightSpecies.map((species) => (
              <Link
                key={species.id}
                href={appendNatureFrom(`/nature/species/${species.slug}`, PAGE_HREF)}
                className="surface-subtle group block overflow-hidden rounded-2xl border border-border/70 bg-background/84 transition-transform hover:-translate-y-0.5 hover:border-primary/35"
              >
                <div className="relative aspect-[4/3] bg-muted/40">
                  {species.coverImageUrl ? (
                    <Image
                      src={species.coverImageUrl}
                      alt={species.commonName}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(min-width: 1536px) 260px, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Leaf className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-base font-medium text-foreground">{species.commonName}</p>
                  {species.scientificName ? (
                    <p className="mt-1 text-xs italic leading-5 text-muted-foreground">{species.scientificName}</p>
                  ) : null}
                  {species.taxonGroup ? (
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{species.taxonGroup}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="surface-subtle mt-5 rounded-2xl px-4 py-6 text-sm text-muted-foreground">
            暂无可展示的树木物种。
          </div>
        )}

        <div className="mt-5 sm:hidden">
          <Link
            href="/nature/species?topic=plants"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            查看全部物种
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <TopicHotspotPanel locations={hotspots} topicLabel="树木" fromHref={PAGE_HREF} />

      <section className="surface-panel overflow-hidden p-5 sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">树木观察记录</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">最近公开记录</h2>
          </div>
          <Link
            href="/nature/observations"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            查看全部
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {displayObservations.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {displayObservations.map((observation) => (
              <Link
                key={observation.id}
                href={appendNatureFrom(`/nature/observations/${observation.id}`, PAGE_HREF)}
                className="surface-subtle block overflow-hidden transition-transform hover:-translate-y-0.5"
              >
                {observation.mediaUrls[0] ? (
                  <ObservationPhotoFrame
                    src={observation.mediaUrls[0]}
                    alt={observation.locationName}
                    className="aspect-[16/9]"
                    paddingClassName="p-2.5"
                    sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                  />
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
        ) : (
          <div className="surface-subtle mt-5 rounded-2xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            暂无可展示的树木观察记录。
          </div>
        )}
      </section>
    </NatureShell>
  );
}
