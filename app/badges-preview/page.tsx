import React from "react";
import { BADGES } from "@/lib/gamification/badges";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";

export default function BadgesPreviewPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 bg-white dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">徽章样式全面预览 (All Badges Preview)</h1>
        <p className="text-muted-foreground">此页面展示了所有徽章，已强制解锁，以便检查 SVG 和图标显示效果。</p>
      </div>

      <div className="space-y-16">
        {/* 分级展示：金、银、铜、白金，以及尺寸展示 */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 border-b pb-2">基础材质测试 (Material & Glow Test)</h2>
          <div className="flex flex-wrap gap-12 justify-center items-end bg-slate-50 dark:bg-slate-900 p-8 rounded-2xl">
            <div className="flex flex-col items-center gap-4">
              <BadgeIcon icon="trophy" tier="bronze" size="xl" />
              <span className="font-mono text-sm">青铜 (Bronze)</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BadgeIcon icon="star" tier="silver" size="xl" />
              <span className="font-mono text-sm">白银 (Silver)</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BadgeIcon icon="award" tier="gold" size="xl" />
              <span className="font-mono text-sm">黄金 (Gold)</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BadgeIcon icon="crown" tier="platinum" size="xl" />
              <span className="font-mono text-sm">白金 (Platinum)</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BadgeIcon icon="rocket" size="xl" locked />
              <span className="font-mono text-sm">未解锁 (Locked)</span>
            </div>
          </div>
        </section>

        {/* 尺寸测试 */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 border-b pb-2">不同尺寸 (Sizes)</h2>
          <div className="flex flex-wrap gap-8 items-end p-8">
            <BadgeIcon icon="sparkles" tier="gold" size="sm" />
            <BadgeIcon icon="sparkles" tier="gold" size="md" />
            <BadgeIcon icon="sparkles" tier="gold" size="lg" />
            <BadgeIcon icon="sparkles" tier="gold" size="xl" />
          </div>
        </section>

        {/* 完整列表 */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 border-b pb-2">系统所有独立与阶梯徽章 (All Defined Badges)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {BADGES.map((badge) => (
              <div 
                key={badge.id} 
                className="flex flex-col items-center text-center gap-3 p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
              >
                <BadgeIcon 
                  icon={badge.icon} 
                  tier={badge.tier || "bronze"} 
                  size="lg" 
                  locked={false} 
                />
                <div className="text-sm font-medium">{badge.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2" title={badge.description}>
                  {badge.description}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
