"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Lock, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { useGamification } from '@/lib/context/gamification-context';
import { cn } from "@/lib/utils";

const baseOptions = [
  { value: "light" as const, label: "浅色", description: "使用明亮背景，适合白天浏览与展示内容。", icon: Sun },
  { value: "dark" as const, label: "深色", description: "降低夜间阅读刺激，减少长时间浏览负担。", icon: Moon },
  { value: "system" as const, label: "跟随系统", description: "根据设备外观自动切换，不需要手动调整。", icon: Monitor },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { level } = useGamification();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const currentTheme = mounted ? theme ?? "system" : "system";
  const blackGoldUnlocked = level >= 50;

  return (
    <SettingsSubpageShell
      title="外观"
      kicker="显示偏好"
      description="选择全站明暗模式。外观设置只影响视觉呈现，不改变内容和账号数据。"
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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-500/12 text-amber-500">
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
