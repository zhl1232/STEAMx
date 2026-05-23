"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, KeyRound, Loader2, Smartphone } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/lib/context/auth-context';
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toE164 } from "@/lib/utils/phone";

function maskPhone(phone: string) {
  const local = phone.replace(/^\+?86/, "");
  return local.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function SecuritySettingsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
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
      setPhoneStep("idle");
      setPhoneInput("");
      setOtpInput("");
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
      description="管理登录密码和手机号绑定。涉及身份验证的操作会给出明确反馈。"
    >
      <div className="space-y-4">
        {recoveryMode ? (
          <div className="surface-subtle border-primary/20 bg-primary/[0.08] px-4 py-4 text-sm leading-6 text-foreground/90">
            请先设置新密码，设置成功后即可继续使用账号。
          </div>
        ) : null}

        <section className="surface-subtle p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">修改密码</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  更新登录密码。建议至少 6 位，并避免与其他常用密码重复。
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={passwordExpand ? "secondary" : "outline"}
              className="rounded-full"
              onClick={() => setPasswordExpand((prev) => !prev)}
            >
              {passwordExpand ? "收起" : "展开"}
              <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", passwordExpand && "rotate-180")} />
            </Button>
          </div>

          {passwordExpand ? (
            <div className="mt-5 space-y-3 border-t border-border/70 pt-5">
              <Input
                placeholder="新密码（至少 6 位）"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <Input
                placeholder="确认新密码"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <Button
                type="button"
                className="h-11 rounded-2xl px-5 text-sm font-semibold"
                onClick={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认修改
              </Button>
            </div>
          ) : null}
        </section>

        <section className="surface-subtle p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">手机号绑定</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {authPhone ? "当前号码已绑定，可用于身份确认。" : "补充一个可接收短信的手机号，用于后续验证。"}
                </p>
              </div>
            </div>
            {authPhone ? (
              <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {maskPhone(authPhone)}
              </span>
            ) : (
              <Button
                type="button"
                variant={phoneExpand ? "secondary" : "outline"}
                className="rounded-full"
                onClick={() => setPhoneExpand((prev) => !prev)}
              >
                {phoneExpand ? "收起" : "开始绑定"}
                <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", phoneExpand && "rotate-180")} />
              </Button>
            )}
          </div>

          {!authPhone && phoneExpand ? (
            <div className="mt-5 space-y-3 border-t border-border/70 pt-5">
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-2xl border border-border/80 bg-background/80 px-3 text-sm text-muted-foreground">
                  +86
                </span>
                <Input
                  placeholder="手机号"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  className="h-11 rounded-2xl"
                  disabled={phoneStep === "verify"}
                />
                {phoneStep === "idle" ? (
                  <Button
                    type="button"
                    className="h-11 rounded-2xl px-4 text-sm font-semibold"
                    onClick={handleSendPhoneOtp}
                    disabled={phoneLoading}
                  >
                    {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送验证码"}
                  </Button>
                ) : null}
              </div>

              {phoneStep === "verify" ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="验证码"
                      value={otpInput}
                      onChange={(event) => setOtpInput(event.target.value)}
                      className="h-11 rounded-2xl"
                    />
                    <Button
                      type="button"
                      className="h-11 rounded-2xl px-5 text-sm font-semibold"
                      onClick={handleVerifyPhoneOtp}
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认绑定"}
                    </Button>
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">
                    未收到验证码时，请确认手机号填写无误，或稍后再试。
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
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
