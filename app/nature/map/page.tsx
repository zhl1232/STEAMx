import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Map, MapPin } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map";
import { Button } from "@/components/ui/button";
import { getNatureObservationHotspots } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildNavigationHref } from "@/lib/utils/nature-navigation";

export const metadata: Metadata = buildPageMetadata({
  title: "观察地图",
  description: "基于公开自然观察记录生成社区热点地图，查看哪些地点近期更活跃、积累了更多真实观察数据。",
  path: "/nature/map",
  keywords: ["观察地图", "自然观察热点", "观鸟地图", "热点地点"],
});

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

export default async function NatureMapPage() {
  const hotspots = await getNatureObservationHotspots(50);
  const validHotspots = hotspots.filter((hotspot) => hotspot.latitude != null && hotspot.longitude != null);
  const totalRecords = hotspots.reduce((sum, hotspot) => sum + hotspot.observationCount, 0);

  return (
    <NatureShell
      title="观察地图"
      description="基于公开自然观察记录中的真实经纬度，查看当前社区的观察热点。"
      fallbackHref="/nature"
      aside={
        <section className="surface-panel p-5 sm:p-6">
          <p className="section-kicker">地图数据</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{formatCount(hotspots.length)} 个热点地点</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            由 {formatCount(totalRecords)} 条公开观察记录聚合而来；点越大表示该地点记录越多，颜色和透明度会随最近记录时间变化。
          </p>
        </section>
      }
    >
      <section className="surface-panel overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-sky-200/80 bg-sky-50/90 p-3 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
              <Map className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">真实观察热点图</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              只展示带坐标的公开记录；隐藏坐标或未填写坐标的记录不会出现在地图上。
            </p>
          </div>
          <Button asChild tone="brand" className="h-11 gap-2 px-5 text-sm font-medium transition-transform hover:-translate-y-0.5">
            <Link href="/nature/submit">
              发布观察
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {validHotspots.length > 0 ? (
          <div className="mt-6">
            <DomesticMiniMap
              markers={validHotspots.map((hotspot) => ({
                latitude: hotspot.latitude as number,
                longitude: hotspot.longitude as number,
                label: hotspot.locationName,
                observedAt: hotspot.latestObservedAt,
                weight: hotspot.observationCount,
                imageUrl: hotspot.imageUrl,
                summary: `最近 ${formatDate(hotspot.latestObservedAt)} 有观察记录，共 ${formatCount(hotspot.observationCount)} 条公开记录。`,
                href: buildNavigationHref({
                  latitude: hotspot.latitude as number,
                  longitude: hotspot.longitude as number,
                  name: hotspot.locationName,
                  from: "/nature/map",
                }),
              }))}
              heightClassName="h-[420px]"
              enableTimeDecay
            />
          </div>
        ) : (
          <div className="surface-subtle mt-6 rounded-md border border-dashed border-border/80 px-5 py-12 text-center text-sm leading-7 text-muted-foreground">
            当前公开观察记录里还没有可展示的坐标。新的带坐标观察通过审核后会自动出现在这里。
          </div>
        )}
      </section>

      <section className="surface-panel overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">热点列表</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">按记录数排序</h2>
          </div>
          <Link
            href="/nature/observations"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            查看观察记录
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {hotspots.map((hotspot, index) => (
            <div key={hotspot.locationName} className="surface-subtle rounded-md border border-border/70 bg-background/80 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold">{hotspot.locationName}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {formatCount(hotspot.observationCount)} 条记录
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      最近 {formatDate(hotspot.latestObservedAt)}
                    </span>
                  </div>
                  {hotspot.latitude != null && hotspot.longitude != null ? (
                    <Link
                      href={buildNavigationHref({
                        latitude: hotspot.latitude,
                        longitude: hotspot.longitude,
                        name: hotspot.locationName,
                        from: "/nature/map",
                      })}
                      className="mt-3 inline-flex text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
                    >
                      坐标 {hotspot.latitude.toFixed(4)}, {hotspot.longitude.toFixed(4)}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {hotspots.length === 0 ? (
          <div className="surface-subtle mt-5 rounded-md border border-dashed border-border/80 px-5 py-10 text-center text-sm text-muted-foreground">
            暂无真实热点地点。
          </div>
        ) : null}
      </section>
    </NatureShell>
  );
}
