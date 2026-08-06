"use client";

import { useEffect, useState } from "react";
import { Bot, Lightbulb, Mic, MessageCircle, Volume2 } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import {
  getTutorVoicePreferences,
  setTutorVoicePreference,
  type TutorVoicePreferenceKey,
  type TutorVoicePreferences,
} from "@/components/features/tutor/tutor-voice";
import { cn } from "@/lib/utils";

type VoicePreferenceOption = {
  key: TutorVoicePreferenceKey;
  icon: typeof Volume2;
  label: string;
  description: string;
};

const voicePreferenceOptions: VoicePreferenceOption[] = [
  {
    key: "autoReadReplies",
    icon: Volume2,
    label: "自动朗读新回复",
    description: "回复完成后自动播放语音。",
  },
  {
    key: "mobileLongPressInput",
    icon: Mic,
    label: "长按小迪语音输入",
    description: "长按小迪说话，松手自动发送。",
  },
  {
    key: "voiceInputAutoPlay",
    icon: MessageCircle,
    label: "语音提问后播报",
    description: "语音提问时，仍播报本次回复。",
  },
  {
    key: "showLongPressHint",
    icon: Lightbulb,
    label: "显示长按提示",
    description: "偶尔显示长按说话提示。",
  },
];

export default function XiaodiSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [preferences, setPreferences] = useState<TutorVoicePreferences>(() => getTutorVoicePreferences(null));

  useEffect(() => {
    setMounted(true);
    setPreferences(getTutorVoicePreferences());
  }, []);

  const togglePreference = (key: TutorVoicePreferenceKey) => {
    const nextValue = !preferences[key];
    setPreferences((current) => ({ ...current, [key]: nextValue }));
    setTutorVoicePreference(key, nextValue);
  };

  return (
    <SettingsSubpageShell
      title="小迪语音"
      kicker="AI 导师"
      description="设置小迪的语音偏好，仅保存在本设备。"
      aside={
        <div className="px-1 pt-1">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">使用方式</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                手机可长按小迪说话；桌面端在面板中点击麦克风。
              </p>
            </div>
          </div>
        </div>
      }
    >
      <div className="settings-list">
        {voicePreferenceOptions.map((option) => {
          const enabled = preferences[option.key];

          return (
            <button
              key={option.key}
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={!mounted}
              onClick={() => togglePreference(option.key)}
              className="settings-row disabled:cursor-wait disabled:opacity-75"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="settings-icon">
                  <option.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{option.label}</div>
                  <p className="settings-description">{option.description}</p>
                </div>
              </div>
              <span
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
                  enabled ? "border-primary bg-primary/90" : "border-border/80 bg-muted",
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-background shadow-xs transition-transform",
                    enabled ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </SettingsSubpageShell>
  );
}
