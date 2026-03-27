"use client";

import { useState, useEffect } from "react";
import { MessageSquareOff, Users, Globe, UserX, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

type MessagePrivacy = "everyone" | "followers_only" | "nobody";

const PRIVACY_OPTIONS: { value: MessagePrivacy; label: string; desc: string; icon: typeof Globe }[] = [
  { value: "everyone", label: "所有人", desc: "任何已登录用户可以向你发送私信", icon: Globe },
  { value: "followers_only", label: "仅关注我的人", desc: "只有关注你的用户才能发送私信", icon: Users },
  { value: "nobody", label: "关闭私信", desc: "不接收任何人的私信", icon: MessageSquareOff },
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
        setMessagePrivacy(
          (data as { message_privacy: string }).message_privacy as MessagePrivacy
        );
      }
      setIsLoading(false);
    };
    load();
  }, [user, supabase]);

  const handleChange = async (value: MessagePrivacy) => {
    if (value === messagePrivacy || isSaving) return;
    setIsSaving(true);
    const prev = messagePrivacy;
    setMessagePrivacy(value);

    const { error } = await supabase
      .from("profiles")
      .update({ message_privacy: value } as never)
      .eq("id", user!.id);

    if (error) {
      setMessagePrivacy(prev);
      toast({ title: "保存失败", description: "请稍后重试", variant: "destructive" });
    } else {
      toast({ title: "已保存" });
    }
    setIsSaving(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      <MobilePageHeader title="隐私设置" fallbackHref="/settings" />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4">
          {/* 私信权限 */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground px-1">
              谁可以给我发私信
            </h2>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                PRIVACY_OPTIONS.map((opt, index) => (
                  <div key={opt.value}>
                    <button
                      onClick={() => handleChange(opt.value)}
                      disabled={isSaving}
                      className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <opt.icon className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <span className="font-medium text-sm block">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.desc}</span>
                        </div>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border-2 transition-colors ${
                          messagePrivacy === opt.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {messagePrivacy === opt.value && (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </button>
                    {index < PRIVACY_OPTIONS.length - 1 && <Separator className="ml-14" />}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 黑名单占位 */}
          <div className="overflow-hidden rounded-2xl border bg-card">
            <button
              onClick={() => toast({ title: "功能开发中" })}
              className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserX className="h-4 w-4" />
                </div>
                <span className="font-medium text-sm">黑名单管理</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">0 人</span>
              </div>
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
