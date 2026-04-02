"use client";

import { useEffect, useState } from "react";
import { Globe, Loader2, MessageSquareOff, UserX, Users } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MessagePrivacy = "everyone" | "followers_only" | "nobody";

const PRIVACY_OPTIONS: { value: MessagePrivacy; label: string; desc: string; icon: typeof Globe }[] = [
  { value: "everyone", label: "所有人", desc: "任何已登录用户都可以向你发送私信。", icon: Globe },
  { value: "followers_only", label: "仅关注我的人", desc: "只有已经关注你的用户才能发起私信。", icon: Users },
  { value: "nobody", label: "关闭私信", desc: "不接收任何人的私信，减少外部打扰。", icon: MessageSquareOff },
];

export default function PrivacySettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [messagePrivacy, setMessagePrivacy] = useState<MessagePrivacy>("everyone");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("message_privacy")
        .eq("id", user.id)
        .single();
      if (data) {
        setMessagePrivacy((data as { message_privacy: string }).message_privacy as MessagePrivacy);
      }
      setIsLoading(false);
    };

    void load();
  }, [user, supabase]);

  const handleChange = async (value: MessagePrivacy) => {
    if (!user || value === messagePrivacy || isSaving) return;

    setIsSaving(true);
    const previousValue = messagePrivacy;
    setMessagePrivacy(value);

    const { error } = await supabase
      .from("profiles")
      .update({ message_privacy: value } as never)
      .eq("id", user.id);

    if (error) {
      setMessagePrivacy(previousValue);
      toast({ title: "保存失败", description: "请稍后重试", variant: "destructive" });
    } else {
      toast({ title: "已保存" });
    }

    setIsSaving(false);
  };

  return (
    <SettingsSubpageShell
      title="隐私设置"
      description="决定谁可以主动联系你，以及哪些互动需要被收得更紧，避免无效打扰。"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">联系范围</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {messagePrivacy === "everyone" ? "开放联系" : messagePrivacy === "followers_only" ? "仅向熟悉的人开放" : "已关闭私信"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              私信权限只影响新消息入口，不影响你已经加入的现有会话与系统通知。
            </p>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">后续扩展</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">黑名单会继续补齐</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              当前先保留私信范围控制，后续会把屏蔽列表和更细的可见性选项补进这一页。
            </p>
          </section>
        </>
      }
    >
      {isLoading ? (
        <div className="surface-subtle flex min-h-56 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="px-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">谁可以给我发私信</h2>
            </div>
            <div className="space-y-3">
              {PRIVACY_OPTIONS.map((opt) => {
                const active = messagePrivacy === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => void handleChange(opt.value)}
                    disabled={isSaving}
                    className={cn(
                      "surface-subtle flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-70",
                      active && "border-primary/40 bg-primary/[0.08]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <opt.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{opt.desc}</p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        active ? "border-primary bg-primary" : "border-muted-foreground/30 bg-background/70",
                      )}
                    >
                      {active ? <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface-subtle p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserX className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">黑名单管理</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    后续将补充屏蔽用户、限制互动等更细粒度控制。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toast({ title: "功能开发中" })}
                className="inline-flex rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                0 人
              </button>
            </div>
          </section>
        </div>
      )}
    </SettingsSubpageShell>
  );
}
