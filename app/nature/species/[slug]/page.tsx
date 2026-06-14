import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AudioLines, Binoculars, CalendarDays, Feather, Leaf, MapPin } from "lucide-react";

import { SpeciesHotspotPanel } from "@/components/features/bird-observation/species-hotspot-panel";
import { SpeciesStatsPanel } from "@/components/features/bird-observation/species-stats-panel";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getSpeciesBySlug } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { resolveAssetDisplayUrl } from "@/lib/utils/asset-url";
import { normalizeNatureFrom } from "@/lib/utils/nature-navigation";
import { splitTaxonGroup, toSpeciesPinyinLabel } from "@/lib/utils/species-pinyin";
import { SpeciesImageGallery } from "./species-image-gallery";

interface SpeciesDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}

interface TextInfoCardProps {
  icon: ReactNode;
  title: string;
  text: string;
  illustrationSrc: string;
  children?: ReactNode;
}

function TextInfoCard({ icon, title, text, illustrationSrc, children }: TextInfoCardProps) {
  return (
    <section className="surface-subtle relative isolate overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] transition-colors hover:bg-background sm:min-h-[178px] sm:p-6">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-0 w-[60%] opacity-[0.52] dark:opacity-30 lg:w-[55%]"
        style={{
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 18%, rgba(0,0,0,0.5) 40%, black 65%)",
          maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 18%, rgba(0,0,0,0.5) 40%, black 65%)",
        }}
        aria-hidden
      >
        <Image src={illustrationSrc} alt="" fill className="object-cover object-right mix-blend-multiply dark:invert dark:mix-blend-screen" sizes="(max-width: 640px) 240px, 420px" />
      </div>
      <div className="relative z-10 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      </div>
      <div className="relative z-10 mt-3 text-sm leading-7 text-muted-foreground sm:mt-4">
        <div
          className="pointer-events-none float-right -mr-5 -mt-10 mb-1 ml-5 h-32 w-[48%] opacity-0 sm:-mr-6 sm:-mt-12 sm:ml-4 sm:h-32 sm:w-44 lg:h-36 lg:w-52"
          style={{
            shapeOutside: "ellipse(48% 42% at 63% 56%)",
          }}
          aria-hidden
        />
        <p>{text}</p>
        {children}
      </div>
    </section>
  );
}

export async function generateMetadata({ params }: SpeciesDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const species = await getSpeciesBySlug(slug);

  if (!species) {
    return {
      title: "物种未找到",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description =
    species.identificationNotes ||
    species.habitatNotes ||
    species.seasonalityNotes ||
    `${species.commonName} 的物种档案，包含识别特征、常见环境和近期观察线索。`;

  return buildPageMetadata({
    title: species.commonName,
    description: description.slice(0, 160),
    path: `/nature/species/${species.slug}`,
    image: species.coverImageUrl || undefined,
    keywords: [
      species.commonName,
      species.scientificName,
      species.aliasesDisplay,
      species.taxonGroup,
      "物种档案",
      "自然观察",
    ],
  });
}

export default async function SpeciesDetailPage({ params, searchParams }: SpeciesDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const species = await getSpeciesBySlug(slug);

  if (!species) {
    notFound();
  }

  const recentObservations = species.recentObservations ?? [];
  const currentPath = `/nature/species/${species.slug}`;
  const fallbackHref = normalizeNatureFrom(query.from, "/nature/species");
  const isBirdSpecies = species.topicKey === "birds";
  const archiveLabel = isBirdSpecies
    ? "鸟类档案"
    : species.topicKey === "plants"
      ? "树种档案"
      : species.topicKey === "insects"
        ? "昆虫档案"
        : "物种档案";
  const galleryImageUrls = species.imageUrls?.length
    ? species.imageUrls
    : species.coverImageUrl
      ? [species.coverImageUrl]
      : [];
  const commonNamePinyin = toSpeciesPinyinLabel(species.commonName);
  const aliasesPinyin = toSpeciesPinyinLabel(species.aliasesDisplay);
  const { family, genus } = splitTaxonGroup(species.taxonGroup);
  const topicAssetPrefix = isBirdSpecies
    ? "/assets/species-detail/bird"
    : species.topicKey === "insects"
      ? "/assets/species-detail/insect"
      : "/assets/species-detail/tree";
  const identificationIllustrationUrl = `${topicAssetPrefix}-identification.png`;
  const habitatIllustrationUrl = `${topicAssetPrefix}-habitat.png`;
  const seasonalityIllustrationUrl = `${topicAssetPrefix}-seasonality.png`;
  const audioIllustrationUrl = "/assets/species-detail/bird-audio.png";
  const audioSrc = resolveAssetDisplayUrl(species.audioUrl) ?? species.audioUrl;
  const taxonSummaryItems = [
    species.aliasesDisplay ? { label: "别名", value: species.aliasesDisplay, pinyin: aliasesPinyin } : null,
  ].filter((item): item is { label: string; value: string; pinyin: string | null } => Boolean(item));
  const taxonomyRankItems = [
    family ? { rank: "科", name: family } : null,
    genus ? { rank: "属", name: genus } : null,
    {
      rank: "种",
      name: species.commonName,
    },
  ].filter((item): item is { rank: string; name: string } => Boolean(item));
  const detailInfoCardCount = [
    species.identificationNotes,
    species.habitatNotes,
    species.seasonalityNotes,
    isBirdSpecies,
  ].filter(Boolean).length;
  const detailInfoGridColumnsClass =
    detailInfoCardCount >= 4
      ? "md:grid-cols-2 xl:grid-cols-4"
      : detailInfoCardCount === 3
        ? "md:grid-cols-2 xl:grid-cols-3"
        : detailInfoCardCount === 2
          ? "md:grid-cols-2"
          : "";

  const stats = species.stats ?? {
    totalObservationCount: 0,
    latestObservedAt: null,
    topObservers: [],
    topIdentifiers: [],
    monthlyAggregates: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 })),
    yearlyAggregates: [],
    lifecycleAggregates: [],
    sexAggregates: [],
  };
  const hasObservationStats = stats.totalObservationCount > 0;

  const galleryBlock = (
    <div className="min-w-0">
      {galleryImageUrls.length > 0 ? (
        <div className="-mx-4 sm:mx-0">
          <SpeciesImageGallery imageUrls={galleryImageUrls} speciesName={species.commonName} />
        </div>
      ) : (
        <div className="relative aspect-[4/3] min-h-[220px] min-w-0 overflow-hidden rounded-lg border border-border/70 bg-muted/40 shadow-sm sm:aspect-[1.42] lg:aspect-[1.34]">
          <div className="flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.35),_transparent_45%),linear-gradient(160deg,_rgba(240,253,250,0.95),_rgba(240,249,255,0.92)_52%,_rgba(250,245,255,0.9))] p-5 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_38%),linear-gradient(160deg,_rgba(6,20,18,0.96),_rgba(11,27,34,0.94)_52%,_rgba(26,18,38,0.92))]">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-background/70 text-emerald-700 shadow-sm dark:bg-background/10 dark:text-emerald-300">
              <Feather className="h-7 w-7" />
            </div>
            <div className="rounded-md border border-border/60 bg-background/72 px-3 py-2 backdrop-blur dark:bg-background/10">
              {commonNamePinyin ? (
                <div className="mb-1 text-[11px] text-primary/80">{commonNamePinyin}</div>
              ) : null}
              <div className="text-sm font-semibold">{species.commonName}</div>
              {species.scientificName ? (
                <div className="mt-1 text-[11px] italic leading-5 text-muted-foreground">{species.scientificName}</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const statsBlock = hasObservationStats ? (
    <SpeciesStatsPanel
      totalObservationCount={stats.totalObservationCount}
      latestObservedAt={stats.latestObservedAt}
      topObservers={stats.topObservers}
      topIdentifiers={stats.topIdentifiers}
      monthlyAggregates={stats.monthlyAggregates}
      yearlyAggregates={stats.yearlyAggregates}
      lifecycleAggregates={stats.lifecycleAggregates}
      sexAggregates={stats.sexAggregates}
    />
  ) : null;

  const detailsBlock = (
    <div className="space-y-7">
      <section className="surface-subtle relative isolate overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] sm:p-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] md:items-start">
          <div className="min-w-0">
            <p className="inline-flex rounded-xs bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {archiveLabel}
            </p>
            {commonNamePinyin ? (
              <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-primary/78 md:text-sm">
                {commonNamePinyin}
              </p>
            ) : null}
            <h1 className="mt-1.5 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight md:text-5xl">
              {species.commonName}
              {species.topicKey === "plants" ? <Leaf className="h-6 w-6 text-primary/60" aria-hidden /> : null}
            </h1>
            {species.scientificName ? (
              <p className="mt-2 text-base italic leading-7 text-muted-foreground md:mt-3 md:text-lg">
                {species.scientificName}
              </p>
            ) : null}

            {taxonSummaryItems.length > 0 ? (
              <dl className="mt-4 flex flex-wrap gap-2 text-sm leading-6 md:mt-5">
                {taxonSummaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2 rounded-sm bg-muted/45 px-3 py-1.5 text-muted-foreground"
                  >
                    <dt className="shrink-0 text-xs font-medium text-foreground/70">{item.label}</dt>
                    <dd className="min-w-0">
                      <span>{item.value}</span>
                      {item.pinyin ? <span className="ml-2 text-xs text-primary/70">{item.pinyin}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {taxonomyRankItems.length > 0 ? (
            <div className="border-t border-border/60 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-1">
              <p className="text-xs font-medium text-muted-foreground">分类</p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {taxonomyRankItems.map((item) => (
                  <div key={item.rank} className="min-w-0 rounded-sm bg-muted/40 px-2.5 py-2.5 text-center">
                    <dt className="text-[11px] font-medium text-muted-foreground">{item.rank}</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-foreground">{item.name}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </section>

      <div className={`grid gap-4 ${detailInfoGridColumnsClass}`}>
        {species.identificationNotes ? (
          <TextInfoCard
            icon={<Leaf className="h-5 w-5 text-emerald-600" />}
            title="识别特征"
            text={species.identificationNotes}
            illustrationSrc={identificationIllustrationUrl}
          />
        ) : null}

        {species.habitatNotes ? (
          <TextInfoCard
            icon={<MapPin className="h-5 w-5 text-emerald-600" />}
            title="常见环境"
            text={species.habitatNotes}
            illustrationSrc={habitatIllustrationUrl}
          />
        ) : null}

        {species.seasonalityNotes ? (
          <TextInfoCard
            icon={<CalendarDays className="h-5 w-5 text-emerald-600" />}
            title="常见时段"
            text={species.seasonalityNotes}
            illustrationSrc={seasonalityIllustrationUrl}
          />
        ) : null}

        {isBirdSpecies ? (
          <TextInfoCard
            icon={<AudioLines className="h-5 w-5 text-emerald-600" />}
            title="鸟鸣音频"
            text={species.audioUrl ? "音频按需加载，点击后开始缓冲播放。" : "暂未收录该物种音频，后续会持续补充。"}
            illustrationSrc={audioIllustrationUrl}
          >
            {audioSrc ? (
              <div className="clear-both mt-4">
                <audio className="w-full" controls preload="none" src={audioSrc}>
                  你的浏览器不支持音频播放，可直接打开链接：{audioSrc}
                </audio>
              </div>
            ) : null}
          </TextInfoCard>
        ) : null}
      </div>

      {species.topLocations && species.topLocations.length > 0 ? (
        <SpeciesHotspotPanel
          locations={species.topLocations}
          recentObservations={recentObservations}
          currentPath={currentPath}
        />
      ) : (
        <section className="surface-subtle relative overflow-hidden rounded-lg p-5 sm:p-6">
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <Binoculars className="h-5 w-5 text-muted-foreground/70" />
              <h2 className="text-lg font-semibold text-muted-foreground">最近观察记录</h2>
            </div>
            <div className="mt-4 flex min-h-[100px] items-center justify-center rounded-md border border-dashed border-border/60 bg-background/40">
              <p className="text-sm text-muted-foreground/80">暂无相关的公开观察数据</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="app-shell-wide px-0 pb-24 pt-0 md:px-8 md:pb-10 md:pt-8">
      <MobilePageHeader
        title={species.commonName}
        fallbackHref={fallbackHref}
        className="mb-0 md:hidden"
      />

      <div className="md:surface-panel overflow-hidden md:rounded-[var(--radius-lg)]">
        <div className="px-4 pb-5 pt-2 sm:p-7">
          <div
            className={
              hasObservationStats
                ? "grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1fr)] lg:gap-7"
                : "mx-auto grid max-w-5xl gap-6"
            }
          >
            <div className={hasObservationStats ? "lg:row-start-1 lg:col-start-1" : ""}>{galleryBlock}</div>
            {hasObservationStats ? (
              <div className="order-last lg:order-none lg:row-start-1 lg:col-start-2">{statsBlock}</div>
            ) : null}
            <div className={hasObservationStats ? "lg:col-span-2 lg:row-start-2" : ""}>{detailsBlock}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
