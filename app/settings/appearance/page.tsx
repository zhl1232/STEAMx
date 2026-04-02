"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Lock, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { useGamification } from "@/context/gamification-context";
import { cn } from "@/lib/utils";

const baseOptions = [
  { value: "light" as const, label: "浅色", description: "使用明亮背景，适合白天浏览与展示内容。", icon: Sun },
  { value: "dark" as const, label: "深色", description: "降低夜间阅读刺激，减少长时间浏览负担。", icon: Moon },
  { value: "system" as const, label: "跟随系统", description: "根据设备外观自动切换，不需要手动调整。", icon: Monitor },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { level = 1 } = useGamification();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const currentTheme = mounted ? theme ?? "system" : "system";
  const blackGoldUnlocked = level >= 50;

  return (
    <SettingsSubpageShell
      title="外观"
      description="统一管理平台的显示模式与特殊主题，让视觉偏好和你的使用场景保持一致。"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">当前选择</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {baseOptions.find((item) => item.value === currentTheme)?.label ?? (currentTheme === "black-gold" ? "黑金传说" : "跟随系统")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              主题会立即应用到全站，包括导航、卡片、表单和详情页层级。
            </p>
            <div className="mt-5 grid gap-3">
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                移动端和桌面端会共用同一套主题设置。
              </div>
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                黑金主题需要账号等级达到 Lv.50 才会解锁。
              </div>
            </div>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">解锁进度</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">等级越高，可选外观越完整</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              当前等级为 Lv.{level}。如果还没达到 Lv.50，可以先通过完成项目、互动和观察记录慢慢积累。
            </p>
          </section>
        </>
      }
    >
      <div className="space-y-3">
        {baseOptions.map((opt) => {
          const selected = currentTheme === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={cn(
                "surface-subtle flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-transform hover:-translate-y-0.5",
                selected && "border-primary/40 bg-primary/[0.08]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <opt.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{opt.description}</p>
                </div>
              </div>
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground transition-colors",
                  selected && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <Check className="h-4 w-4" />
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (blackGoldUnlocked) {
              setTheme("black-gold");
            }
          }}
          disabled={!blackGoldUnlocked}
          className={cn(
            "surface-subtle flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70",
            currentTheme === "black-gold" && "border-amber-500/40 bg-amber-500/[0.08]",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-500">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                黑金传说
                {!blackGoldUnlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Lv.50 解锁
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {blackGoldUnlocked ? "尊贵黑金配色已开放，可应用到全站界面。" : "达到 Lv.50 后可开启专属配色。"}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground transition-colors",
              currentTheme === "black-gold" && "border-amber-500 bg-amber-500 text-background",
            )}
          >
            <Check className="h-4 w-4" />
          </div>
        </button>
      </div>
    </SettingsSubpageShell>
  );
}
