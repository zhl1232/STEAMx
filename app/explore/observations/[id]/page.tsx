import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map";
import { ObservationSocialSection } from "@/components/features/bird-observation/observation-social-section";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getObservationById } from "@/lib/api/nature-observation-data";

interface ObservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ObservationDetailPage({ params }: ObservationDetailPageProps) {
  const { id } = await params;
  const observation = await getObservationById(id);

  if (!observation) {
    notFound();
  }

  return (
    <div className="page-shell pt-6 pb-24 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="观察记录详情" fallbackHref="/explore/observations" />
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <p className="section-kicker">自然观察</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">观察记录 #{observation.id}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{new Date(observation.observedAt).toLocaleString("zh-CN")}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {observation.locationName}
            </span>
            {observation.habitat ? (
              <>
                <span>·</span>
                <span>{observation.habitat}</span>
              </>
            ) : null}
            {observation.weather ? (
              <>
                <span>·</span>
                <span>{observation.weather}</span>
              </>
            ) : null}
          </div>

          {observation.latitude != null && observation.longitude != null ? (
            <div className="mt-6 surface-subtle p-4">
              <DomesticMiniMap
                markers={[
                  {
                    latitude: observation.latitude,
                    longitude: observation.longitude,
                    label: observation.locationName,
                  },
                ]}
              />
              <a
                href={`https://uri.amap.com/marker?position=${observation.longitude},${observation.latitude}&name=${encodeURIComponent(observation.locationName)}&src=steam-explore`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
              >
                在高德地图中查看这个观察点
              </a>
            </div>
          ) : null}

          {observation.notes ? (
            <div className="mt-6 surface-subtle p-5">
              <h2 className="text-lg font-semibold">记录说明</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{observation.notes}</p>
            </div>
          ) : null}

          {observation.mediaUrls.length > 0 ? (
            <section className="mt-6 surface-subtle p-5">
              <h2 className="text-lg font-semibold">观察照片</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {observation.mediaUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/70 bg-background/80"
                  >
                    <Image
                      src={url}
                      alt="观察照片"
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-8 surface-subtle p-5">
            <h2 className="text-xl font-semibold">观察到的物种</h2>
            <div className="mt-4 space-y-4">
              {observation.species.map((item) => (
                <div key={item.speciesId} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.speciesSlug ? (
                      <Link href={`/explore/species/${item.speciesSlug}`} className="text-lg font-semibold hover:text-primary hover:underline">
                        {item.commonName}
                      </Link>
                    ) : (
                      <h3 className="text-lg font-semibold">{item.commonName}</h3>
                    )}
                    {item.count ? (
                      <span className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                        数量：{item.count}
                      </span>
                    ) : null}
                    {item.confidence != null ? (
                      <span className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                        置信度：{Math.round(item.confidence * 100)}%
                      </span>
                    ) : null}
                  </div>

                  {item.behaviorTags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.behaviorTags.map((tag) => (
                        <span key={`${item.speciesId}-${tag}`} className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {item.notes ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <ObservationSocialSection
            observationId={observation.id}
            initialLikesCount={observation.likesCount}
            initialCommentsCount={observation.commentsCount}
          />

          <section className="mt-8 surface-subtle p-5">
            <h2 className="text-xl font-semibold">下一步可以做什么</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {observation.species[0]?.speciesSlug ? (
                <Link
                  href={`/explore/species/${observation.species[0].speciesSlug}`}
                  className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="text-xs text-muted-foreground">认识这种鸟</div>
                  <div className="mt-1 font-medium">返回物种页</div>
                </Link>
              ) : null}
              <Link
                href="/bird-observation/submit"
                className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-transform hover:-translate-y-0.5"
              >
                <div className="text-xs text-muted-foreground">继续沉淀</div>
                <div className="mt-1 font-medium">再记录一次观察</div>
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
