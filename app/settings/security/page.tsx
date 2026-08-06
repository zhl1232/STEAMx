"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ChevronDown, ChevronUp, KeyRound, Loader2, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/lib/context/auth-context';
import { useLoginPrompt } from '@/lib/context/login-prompt-context';
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { toE164 } from "@/lib/utils/phone";

function maskPhone(phone: string) {
  const local = phone.replace(/^\+?86/, "");
  return local.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function SecuritySettingsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const { completeAgeConfirmation } = useLoginPrompt();
  const [supabase] = useState(() => createClient());
  const recoveryMode = searchParams.get("mode") === "recovery";

  const [authPhone, setAuthPhone] = useState<string | null>(null);
  const [phoneExpand, setPhoneExpand] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phoneStep, setPhoneStep] = useState<"idle" | "verify">("idle");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [passwordExpand, setPasswordExpand] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [ageConfirmedAt, setAgeConfirmedAt] = useState<string | null>(profile?.age_confirmed_at ?? null);
  const [ageLoading, setAgeLoading] = useState(false);

  const resetPhoneFlow = (clearPhone = false) => {
    setPhoneStep("idle");
    setOtpInput("");
    if (clearPhone) {
      setPhoneInput("");
    }
  };

  useEffect(() => {
    const loadPhone = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setAuthPhone(authUser?.phone ?? null);
    };

    if (user) {
      void loadPhone();
    }
  }, [user, supabase.auth]);

  useEffect(() => {
    if (!recoveryMode) return;
    setPasswordExpand(true);
  }, [recoveryMode]);

  useEffect(() => {
    if (!user) return;

    const loadAgeConfirmation = async () => {
      const response = await fetch("/api/settings/age-confirmation");
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      setAgeConfirmedAt(typeof data.confirmedAt === "string" ? data.confirmedAt : null);
    };

    void loadAgeConfirmation();
  }, [user]);

  const handleConfirmAge = async () => {
    setAgeLoading(true);
    try {
      const response = await fetch("/api/settings/age-confirmation", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "确认失败");
      setAgeConfirmedAt(typeof data.confirmedAt === "string" ? data.confirmedAt : new Date().toISOString());
      await refreshProfile();
      toast({ title: "社区互动确认已完成", description: "现在可以发布作品、评论、发帖和发送私信了。" });
      await completeAgeConfirmation();
    } catch (error) {
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setAgeLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "新密码至少 6 位", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "两次输入的密码不一致", variant: "destructive" });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `请求失败 ${res.status}`);
      }
      toast({ title: "修改成功", description: "密码已更新。" });
      setNewPassword("");
      setConfirmPassword("");
      setPasswordExpand(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "修改失败";
      toast({ title: "修改失败", description: message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (authPhone) {
      toast({ title: "已绑定", description: "手机号已绑定，暂不支持换绑。", variant: "destructive" });
      return;
    }

    const formatted = toE164(phoneInput);
    if (!formatted) {
      toast({ title: "请输入手机号", variant: "destructive" });
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, type: "phone_change" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "发送失败");
      setPhoneStep("verify");
      toast({ title: "验证码已发送", description: "请查收短信并输入验证码。" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "发送失败";
      toast({
        title: "发送失败",
        description: message || "请检查手机号或联系管理员。",
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const formatted = toE164(phoneInput);
    if (!otpInput.trim()) {
      toast({ title: "请输入验证码", variant: "destructive" });
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formatted,
          code: otpInput.trim(),
          type: "phone_change",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "验证失败");
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setAuthPhone(authUser?.phone ?? null);
      setPhoneExpand(false);
      resetPhoneFlow(true);
      toast({ title: "绑定成功", description: "手机号已更新。" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "验证失败";
      toast({
        title: "验证失败",
        description: message || "请检查验证码或联系管理员。",
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <SettingsSubpageShell
      title="账号与安全"
      kicker="登录保护"
      description="管理登录方式与互动权限。"
    >
      <div className="space-y-5">
        {recoveryMode ? (
          <div role="status" className="flex items-start gap-3 rounded-md bg-primary/8 px-4 py-3 text-sm leading-6 text-foreground/90">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p>请先设置新密码，设置成功后即可继续使用账号。</p>
          </div>
        ) : null}

        <div className="settings-list">
        <section id="age-confirmation" className="scroll-mt-5 px-3 py-4 sm:px-4 sm:py-5">
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3">
            <div className="settings-icon">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <h3 className="min-w-0 text-sm font-semibold">社区互动确认</h3>
            {ageConfirmedAt ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="h-3.5 w-3.5" />
                已确认
              </span>
            ) : (
              <Button type="button" tone="brand" shape="soft" className="shrink-0" onClick={handleConfirmAge} disabled={ageLoading}>
                {ageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                完成确认
              </Button>
            )}
            <p className="col-start-1 col-end-[-1] mt-3 text-xs leading-5 text-muted-foreground">
              发布、评论、发帖和私信前需确认。
              {!ageConfirmedAt ? (
                <>
                  未成年人请在监护人指导下使用；确认即表示你同意遵守
                  <Link href="/legal/terms" className="mx-1 text-primary underline-offset-2 hover:underline">
                    《服务条款》
                  </Link>
                  和
                  <Link href="/legal/privacy" className="mx-1 text-primary underline-offset-2 hover:underline">
                    《隐私政策》
                  </Link>。
                </>
              ) : null}
            </p>
          </div>
        </section>

        <section className="py-4 sm:py-5">
          <button
            type="button"
            aria-label={passwordExpand ? "收起修改密码" : "展开修改密码"}
            aria-expanded={passwordExpand}
            aria-controls="password-settings"
            className="settings-row group"
            onClick={() => setPasswordExpand((prev) => !prev)}
          >
            <div className="settings-icon">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">修改密码</h3>
            </div>
            {passwordExpand ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            )}
          </button>

          {passwordExpand ? (
            <form
              id="password-settings"
              className="mt-5 space-y-4 px-3 sm:px-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleChangePassword();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">新密码</label>
                  <Input
                    id="new-password"
                    placeholder="至少 6 位"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">确认新密码</label>
                  <Input
                    id="confirm-password"
                    placeholder="再次输入新密码"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" tone="brand" shape="soft" className="h-11 w-full px-5 text-sm font-semibold sm:w-auto" disabled={passwordLoading}>
                  {passwordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  保存新密码
                </Button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="py-4 sm:py-5">
          {authPhone ? (
            <div className="flex items-center gap-3">
              <div className="settings-icon">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">手机号绑定</h3>
              <p className="settings-description">已绑定 · {maskPhone(authPhone)}</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              aria-label={phoneExpand ? "收起手机号绑定" : "展开手机号绑定"}
              aria-expanded={phoneExpand}
              aria-controls="phone-binding"
              className="settings-row group"
              onClick={() => {
                if (phoneExpand) resetPhoneFlow(true);
                setPhoneExpand((prev) => !prev);
              }}
            >
              <div className="settings-icon">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">手机号绑定</h3>
              </div>
              {phoneExpand ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              )}
            </button>
          )}

          {!authPhone && phoneExpand ? (
            <form
              id="phone-binding"
              className="mt-5 space-y-4 px-3 sm:px-4"
              onSubmit={(event) => {
                event.preventDefault();
                void (phoneStep === "idle" ? handleSendPhoneOtp() : handleVerifyPhoneOtp());
              }}
            >
              <div className="grid gap-2">
                <label htmlFor="settings-phone" className="text-xs font-medium text-muted-foreground">手机号</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="inline-flex h-11 shrink-0 items-center rounded-sm bg-background/70 px-3 text-sm text-muted-foreground">+86</span>
                    <Input
                      id="settings-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="请输入手机号"
                      value={phoneInput}
                      onChange={(event) => setPhoneInput(event.target.value)}
                      className="h-11"
                      disabled={phoneStep === "verify" || phoneLoading}
                    />
                  </div>
                  {phoneStep === "idle" ? (
                    <Button type="submit" tone="brand" shape="soft" className="h-11 shrink-0 px-4 text-sm font-semibold sm:min-w-32" disabled={phoneLoading}>
                      {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送验证码"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {phoneStep === "verify" ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid gap-2">
                      <label htmlFor="settings-otp" className="text-xs font-medium text-muted-foreground">短信验证码</label>
                      <Input
                        id="settings-otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="请输入验证码"
                        value={otpInput}
                        onChange={(event) => setOtpInput(event.target.value)}
                        className="h-11"
                        disabled={phoneLoading}
                      />
                    </div>
                    <Button type="submit" tone="brand" shape="soft" className="h-11 self-end px-5 text-sm font-semibold" disabled={phoneLoading}>
                      {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认绑定"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs leading-5 text-muted-foreground">未收到验证码时，请确认手机号填写无误，或稍后再试。</p>
                    <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => resetPhoneFlow()}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      更换号码
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}
        </section>
        </div>
      </div>
    </SettingsSubpageShell>
  );
}

export default function SecuritySettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] bg-background md:min-h-[calc(100vh-4rem)]" />}>
      <SecuritySettingsContent />
    </Suspense>
  );
}
