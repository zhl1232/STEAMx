"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Smartphone, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { toE164 } from "@/lib/utils/phone";

function maskPhone(phone: string) {
  const local = phone.replace(/^\+?86/, "");
  return local.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = createClient();

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
        data: { user: u },
      } = await supabase.auth.getUser();
      setAuthPhone(u?.phone ?? null);
    };
    if (user) loadPhone();
  }, [user, supabase.auth]);

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "修改失败";
      toast({ title: "修改失败", description: msg, variant: "destructive" });
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "发送失败";
      toast({
        title: "发送失败",
        description: msg || "请检查手机号或联系管理员。",
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
        data: { user: u },
      } = await supabase.auth.getUser();
      setAuthPhone(u?.phone ?? null);
      setPhoneExpand(false);
      setPhoneStep("idle");
      setPhoneInput("");
      setOtpInput("");
      toast({ title: "绑定成功", description: "手机号已更新。" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "验证失败";
      toast({
        title: "验证失败",
        description: msg || "请检查验证码或联系管理员。",
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const menuItems: Array<{ label: string; value: string; action?: () => void }> = [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">返回</span>
        </Button>
        <h1 className="text-lg font-semibold">账号与安全</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {menuItems.map((item, index) => (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={item.action}
                  disabled={!item.action && true}
                  className={`flex w-full items-center justify-between bg-card p-4 transition-colors ${item.action ? "hover:bg-accent/50 active:bg-accent" : "cursor-default"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.value}</span>
                </button>
                {index < menuItems.length - 1 && <Separator className="ml-14" />}
              </div>
            ))}

            {menuItems.length > 0 ? <Separator className="ml-14" /> : null}
            <div>
              <button
                type="button"
                onClick={() => setPasswordExpand(!passwordExpand)}
                className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">修改密码</span>
                </div>
              </button>

              {passwordExpand && (
                <div className="border-t px-4 py-4 space-y-3 bg-muted/30">
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="新密码（至少 6 位）"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Input
                      placeholder="确认新密码"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={handleChangePassword}
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认修改"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator className="ml-14" />
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!authPhone) setPhoneExpand(!phoneExpand);
                }}
                className={`flex w-full items-center justify-between bg-card p-4 transition-colors ${authPhone ? "cursor-default" : "hover:bg-accent/50 active:bg-accent"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">手机号绑定</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {authPhone ? maskPhone(authPhone) : "未绑定"}
                </span>
              </button>

              {!authPhone && phoneExpand && (
                <div className="border-t px-4 py-4 space-y-3 bg-muted/30">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center rounded-md border bg-background px-2 text-sm text-muted-foreground">+86</span>
                    <Input
                      placeholder="手机号"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="flex-1"
                      disabled={phoneStep === "verify"}
                    />
                    {phoneStep === "idle" ? (
                      <Button
                        size="sm"
                        onClick={handleSendPhoneOtp}
                        disabled={phoneLoading}
                      >
                        {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送验证码"}
                      </Button>
                    ) : null}
                  </div>
                  {phoneStep === "verify" && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="验证码"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleVerifyPhoneOtp}
                          disabled={phoneLoading}
                        >
                          {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        未收到？检查手机号是否正确，或稍后重试。
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
