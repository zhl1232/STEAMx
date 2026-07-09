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
    label: "自动朗读小迪新回复",
    description: "小迪回复完成后自动播放语音，适合边做项目边听反馈。",
  },
  {
    key: "mobileLongPressInput",
    icon: Mic,
    label: "移动端长按小迪语音输入",
    description: "在手机上长按悬浮小迪即可开始说话，松手后自动发送。",
  },
  {
    key: "voiceInputAutoPlay",
    icon: MessageCircle,
    label: "语音提问后播报回复",
    description: "通过长按语音提问时，即使关闭全局自动朗读，也会播报这次回复。",
  },
  {
    key: "showLongPressHint",
    icon: Lightbulb,
    label: "显示长按语音提示",
    description: "小迪会偶尔在头上提醒可以长按说话，不会频繁打扰。",
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
      description="管理小迪的语音输入、自动播报和移动端长按提示。这些偏好保存在当前设备。"
      aside={
        <section className="surface-panel p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">语音体验</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                长按语音主要面向手机触控使用；桌面端仍可以在小迪面板里点击麦克风输入。
              </p>
            </div>
          </div>
        </section>
      }
    >
      <div className="space-y-3">
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
              className={cn(
                "surface-subtle flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75",
                enabled && "border-primary/35 bg-primary/[0.07]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <option.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{option.label}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
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
                    "absolute top-1 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
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
