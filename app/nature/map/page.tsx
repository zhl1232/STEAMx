import Link from "next/link";
import { ArrowRight, Map } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";

export default function NatureMapPage() {
  return (
    <NatureShell
      title="观察地图"
      description="地图入口先独立出来，后续承接点位、热区、时间筛选和专题视角。"
      fallbackHref="/nature"
      aside={
        <section className="surface-panel p-5 sm:p-6">
          <p className="section-kicker">当前阶段</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">先保留独立入口</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            地图能力会作为自然观察频道的公共基础设施存在，不挂在某一个专题下面。
          </p>
        </section>
      }
    >
      <section className="surface-panel overflow-hidden p-6 sm:p-8">
        <div className="inline-flex rounded-full border border-sky-200/80 bg-sky-50/90 p-3 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
          <Map className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight">地图能力正在整理中</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          这一页会在后续接入观察点位、热区、专题筛选和时间视图。当前可以先从观察记录流和物种页继续浏览。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/nature/observations"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            去看观察记录
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/nature/species"
            className="inline-flex items-center rounded-full border border-border/80 bg-background/80 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted/70"
          >
            去看物种
          </Link>
        </div>
      </section>
    </NatureShell>
  );
}
