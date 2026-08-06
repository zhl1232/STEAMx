"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Megaphone } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { useAuth } from '@/lib/context/auth-context';
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NotificationPreference = {
  notify_followed_creator_updates: boolean;
};

export default function NotificationsSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference>({
    notify_followed_creator_updates: true,
  });

  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notify_followed_creator_updates")
        .eq("id", user.id)
        .single();

      if (error) {
        toast({
          title: "加载通知设置失败",
          description: "请稍后重试",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setPreferences({
        notify_followed_creator_updates:
          (data as NotificationPreference | null)?.notify_followed_creator_updates !== false,
      });
      setIsLoading(false);
    };

    void loadPreferences();
  }, [supabase, toast, user]);

  const handleCreatorUpdateToggle = async () => {
    if (!user || isSaving) return;

    const nextValue = !preferences.notify_followed_creator_updates;
    setIsSaving(true);
    setPreferences((prev) => ({
      ...prev,
      notify_followed_creator_updates: nextValue,
    }));

    const { error } = await supabase
      .from("profiles")
      .update({ notify_followed_creator_updates: nextValue } as never)
      .eq("id", user.id);

    if (error) {
      setPreferences((prev) => ({
        ...prev,
        notify_followed_creator_updates: !nextValue,
      }));
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } else {
      toast({
        title: "已保存",
        description: nextValue ? "已开启创作者更新提醒" : "已关闭创作者更新提醒",
      });
    }

    setIsSaving(false);
  };

  const menuItems = [
    {
      icon: BellRing,
      label: "关注创作者更新",
      value: preferences.notify_followed_creator_updates ? "已开启" : "已关闭",
      description: "关注的创作者发布新动态时提醒你。",
      action: handleCreatorUpdateToggle,
      active: preferences.notify_followed_creator_updates,
    },
    {
      icon: Megaphone,
      label: "系统通知",
      value: "默认开启",
      description: "安全提醒和审核结果始终保留在站内消息中。",
      active: true,
    },
  ];

  return (
    <SettingsSubpageShell
      title="消息与通知"
      kicker="通知规则"
      description="选择需要接收的站内提醒。"
    >
      {isLoading ? (
        <div className="settings-section flex min-h-56 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="settings-list">
          {menuItems.map((item) => {
            const isActionable = Boolean(item.action);
            const rowContent = (
              <>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="settings-icon">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <p className="settings-description">{item.description}</p>
                  </div>
                </div>
                {isActionable ? (
                  <span
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
                      item.active ? "border-primary bg-primary/90" : "border-border/80 bg-muted",
                    )}
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "absolute top-1 h-5 w-5 rounded-full bg-background shadow-xs transition-transform",
                        item.active ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {item.value}
                  </span>
                )}
              </>
            );

            return isActionable ? (
              <button
                key={item.label}
                type="button"
                onClick={() => item.action?.()}
                disabled={isSaving}
                role="switch"
                aria-checked={item.active}
                className={cn(
                  "settings-row",
                  isSaving && "cursor-wait opacity-80",
                )}
              >
                {rowContent}
              </button>
            ) : (
              <div key={item.label} className="settings-row cursor-default">
                {rowContent}
              </div>
            );
          })}
        </div>
      )}
    </SettingsSubpageShell>
  );
}
