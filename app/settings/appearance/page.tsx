"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";

const options = [
  { value: "light" as const, label: "浅色", description: "使用浅色背景", icon: Sun },
  { value: "dark" as const, label: "深色", description: "使用深色背景，护眼", icon: Moon },
  { value: "system" as const, label: "跟随系统", description: "根据系统外观自动切换", icon: Monitor },
];

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const currentTheme = mounted ? theme ?? "system" : "system";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">返回</span>
        </Button>
        <h1 className="text-lg font-semibold">外观</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {options.map((opt, index) => (
              <div key={opt.value}>
                <button
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <opt.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-medium text-sm block">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </div>
                  {currentTheme === opt.value && (
                    <Check className="h-5 w-5 text-primary shrink-0" />
                  )}
                </button>
                {index < options.length - 1 && <Separator className="ml-14" />}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
