"use client";

import { useEffect, useState } from "react";
import { Globe, Loader2, MessageSquareOff, Users } from "lucide-react";

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

        </div>
      )}
    </SettingsSubpageShell>
  );
}
