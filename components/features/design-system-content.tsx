import { FilterChip } from "@/components/ui/filter-chip";
import { Surface } from "@/components/ui/surface";
import { ToneBadge } from "@/components/ui/tone-badge";

export default function DesignSystemContent() {
  return (
    <section className="page-shell py-8 text-foreground sm:py-10">
      <Surface variant="panel" className="flex flex-col gap-8 p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            只读设计系统展示
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">STEAM 探索 UI 基线</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              这里不再展示无关的科幻 demo，而是直接沉淀平台真实会用到的字体、表面、卡片和信息层级。
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Surface variant="subtle" className="p-5 sm:p-6">
            <p className="section-kicker">Typography</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">标题应该稳，正文应该清</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              标题使用衬线字体现出项目感和内容重量，正文保持高可读，适合项目说明、社区帖子和自然观察记录这类长文本内容。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["主标题", "font-heading text-3xl font-semibold"],
                ["正文段落", "text-sm leading-7 text-muted-foreground"],
                ["辅助标签", "section-kicker"],
              ].map(([label, className]) => (
                <div key={label} className="rounded-2xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.8)] p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`mt-3 ${className}`}>STEAM 探索</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface variant="subtle" className="p-5 sm:p-6">
            <p className="section-kicker">Surface</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">统一卡片表面层级</h2>
            <div className="mt-5 space-y-3">
              <div className="surface-subtle px-4 py-3">
                <div className="text-sm font-medium">信息卡</div>
                <div className="text-xs text-muted-foreground">用于设置项、说明块和数据摘要。</div>
              </div>
              <div className="surface-panel px-4 py-4">
                <div className="text-sm font-medium">主内容卡</div>
                <div className="text-xs text-muted-foreground">用于项目详情、专题入口和社区内容区块。</div>
              </div>
            </div>
          </Surface>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Surface variant="subtle" className="overflow-hidden">
            <div className="aspect-[16/10] bg-[radial-gradient(circle_at_top_left,rgba(166,193,238,0.4),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.28))]" />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker">Project Card</p>
                  <h2 className="mt-2 text-xl font-semibold">项目卡片先传达差异，再补充热度</h2>
                </div>
                <ToneBadge tone="science" className="rounded-full px-3 py-1">
                  科学
                </ToneBadge>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                标题、摘要、分类和关键数据拆成三层，移动端列表不会再被一堆重复标签和统计数字淹没。
              </p>
            </div>
          </Surface>

          <Surface variant="subtle" className="p-5 sm:p-6">
            <p className="section-kicker">Control</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">统一导航和分段控件</h2>
            <div className="mt-5 space-y-4">
              <div className="segmented-control">
                <span className="segmented-option segmented-option-active">探索</span>
                <span className="segmented-option">社区</span>
                <span className="segmented-option">游乐场</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active>全部</FilterChip>
                <FilterChip>科学</FilterChip>
                <FilterChip tone="green">自然观察</FilterChip>
                <FilterChip tone="amber">挑战</FilterChip>
              </div>
              <div className="rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.82)] px-4 py-3 text-sm text-muted-foreground shadow-sm">
                搜索框、筛选 chip、主内容面板现在共享同一套圆角、边框和表面层级。
              </div>
            </div>
          </Surface>
        </div>
      </Surface>
    </section>
  );
}
