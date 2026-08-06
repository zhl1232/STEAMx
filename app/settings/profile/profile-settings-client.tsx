"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { AvatarUpload } from "@/components/features/profile/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/lib/context/auth-context';
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { compressImageForBucket } from "@/lib/utils/image-compression";
import {
  PROFILE_BIRTH_YEAR_OPTIONS,
  PROFILE_GENDER_OPTIONS,
  PROFILE_SETTINGS_DEFAULTS,
  type ProfileSettingsUpdateInput,
} from "@/lib/profile/settings";

type SettingsProfileResponse = {
  profile: ProfileSettingsUpdateInput & {
    username: string | null;
    last_uploaded_avatar_url: string | null;
    avatar_url: string | null;
  };
};

export default function ProfileSettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const previewObjectUrlRef = useRef<string | null>(null);

  const [form, setForm] = useState<ProfileSettingsUpdateInput>(PROFILE_SETTINGS_DEFAULTS);
  const [username, setUsername] = useState<string | null>(null);
  const [persistedUploadUrl, setPersistedUploadUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const clearPreviewObjectUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/settings/profile", {
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "个人资料加载失败");
      }

      const payload = (data as SettingsProfileResponse).profile;
      clearPreviewObjectUrl();
      setSelectedFile(null);
      setUsername(payload.username);
      setPersistedUploadUrl(payload.last_uploaded_avatar_url || "");
      setForm({
        display_name: payload.display_name || "",
        bio: payload.bio || "",
        gender: payload.gender,
        birth_year: payload.birth_year,
        birth_month: payload.birth_month,
        avatar_url: payload.avatar_url || PROFILE_SETTINGS_DEFAULTS.avatar_url,
      });
    } catch (error) {
      logger.error(error, { context: "load profile settings" });
      setLoadError(error instanceof Error ? error.message : "个人资料加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [clearPreviewObjectUrl]);

  useEffect(() => {
    void loadProfile();

    return () => {
      clearPreviewObjectUrl();
    };
  }, [clearPreviewObjectUrl, loadProfile]);

  const updateField = <K extends keyof ProfileSettingsUpdateInput>(
    key: K,
    value: ProfileSettingsUpdateInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleFileSelect = (file: File) => {
    clearPreviewObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setSelectedFile(file);
    updateField("avatar_url", objectUrl);
  };

  const handleDefaultAvatarSelect = (avatarUrl: string) => {
    clearPreviewObjectUrl();
    setSelectedFile(null);
    updateField("avatar_url", avatarUrl);
  };

  const uploadSelectedAvatar = async () => {
    if (!selectedFile) {
      return form.avatar_url;
    }

    const prepared = await compressImageForBucket(selectedFile, "avatars");
    const uploadFormData = new FormData();
    uploadFormData.append("file", prepared);
    uploadFormData.append("bucket", "avatars");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: uploadFormData,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || typeof data?.publicUrl !== "string") {
      throw new Error(data?.error || "头像上传失败，请重试");
    }

    return data.publicUrl as string;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const avatarUrl = await uploadSelectedAvatar();
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          avatar_url: avatarUrl,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "保存失败，请稍后重试");
      }

      const payload = (data as SettingsProfileResponse).profile;
      clearPreviewObjectUrl();
      setSelectedFile(null);
      setPersistedUploadUrl(payload.last_uploaded_avatar_url || "");
      setUsername(payload.username);
      setForm({
        display_name: payload.display_name || "",
        bio: payload.bio || "",
        gender: payload.gender,
        birth_year: payload.birth_year,
        birth_month: payload.birth_month,
        avatar_url: payload.avatar_url || PROFILE_SETTINGS_DEFAULTS.avatar_url,
      });
      await refreshProfile();
      router.refresh();
      toast({ title: "资料已保存" });
    } catch (error) {
      logger.error(error, { context: "save profile settings" });
      toast({
        title: error instanceof Error ? error.message : "保存失败，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentAge = (() => {
    if (!form.birth_year || !form.birth_month) {
      return null;
    }

    const now = new Date();
    let age = now.getFullYear() - Number(form.birth_year);
    if (now.getMonth() + 1 < Number(form.birth_month)) {
      age -= 1;
    }
    return age;
  })();

  return (
    <SettingsSubpageShell
      title="个人资料"
      kicker="账号名片"
      description="更新头像、昵称与基础资料。"
    >
      {isLoading ? (
        <div className="space-y-6">
          <div className="settings-section p-5 sm:p-6">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-32 w-32 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-11 w-full rounded-(--radius-sm)" />
            <Skeleton className="h-28 w-full rounded-(--radius-sm)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-(--radius-sm)" />
            <Skeleton className="h-11 w-full rounded-(--radius-sm)" />
          </div>
        </div>
      ) : loadError ? (
        <div className="settings-section p-6 text-center">
          <p className="text-sm leading-7 text-muted-foreground">{loadError}</p>
          <Button className="mt-4" variant="secondary" shape="soft" onClick={() => void loadProfile()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="settings-section p-4 sm:p-5">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
              <AvatarUpload
                value={form.avatar_url}
                persistedUploadUrl={persistedUploadUrl}
                onFileSelect={handleFileSelect}
                onDefaultSelect={handleDefaultAvatarSelect}
                disabled={isSaving}
                showCameraBadge
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">头像</p>
                <p className="mt-1 text-xs text-muted-foreground">支持 JPG、PNG、GIF、WebP，最大 2MB</p>
                <p className="mt-1 text-xs text-muted-foreground">账号 ID：{username || "未设置"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="settings-section-heading">公开资料</h2>
              <span className="shrink-0 text-xs text-muted-foreground">公开展示</span>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="display_name">昵称</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  maxLength={30}
                  onChange={(event) => updateField("display_name", event.target.value)}
                  placeholder="显示的名称"
                  disabled={isSaving}
                  className="h-11"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio">简介</Label>
                <div className="relative">
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={(event) => updateField("bio", event.target.value.slice(0, 30))}
                    placeholder="一句话介绍自己"
                    className="min-h-[96px] resize-none rounded-md pr-12"
                    maxLength={30}
                    rows={3}
                    disabled={isSaving}
                  />
                  <span className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                    {form.bio.length}/30
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="settings-section-heading">补充资料</h2>
              <span className="shrink-0 text-xs text-muted-foreground">可选</span>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="gender">性别</Label>
                <Select
                  value={form.gender || "none"}
                  onValueChange={(value) =>
                    updateField("gender", value === "none" ? null : (value as (typeof PROFILE_GENDER_OPTIONS)[number]))
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger id="gender" className="h-11">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不设置</SelectItem>
                    {PROFILE_GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="birth_year">出生年月</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      updateField("birth_year", null);
                      updateField("birth_month", null);
                    }}
                    disabled={isSaving || (!form.birth_year && !form.birth_month)}
                  >
                    清空
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={form.birth_year || "none"}
                    onValueChange={(value) => updateField("birth_year", value === "none" ? null : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="birth_year" className="h-11 flex-1">
                      <SelectValue placeholder="年" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不设置</SelectItem>
                      {PROFILE_BIRTH_YEAR_OPTIONS.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year} 年
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.birth_month || "none"}
                    onValueChange={(value) => updateField("birth_month", value === "none" ? null : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="birth_month" aria-label="出生月份" className="h-11 w-28">
                      <SelectValue placeholder="月" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不设置</SelectItem>
                      {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
                        <SelectItem key={month} value={month}>
                          {month} 月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentAge !== null ? (
                  <p className="text-xs text-muted-foreground">当前年龄：约 {currentAge} 岁</p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted-foreground">修改会同步到个人主页。</p>
            <Button type="submit" shape="soft" className="h-11 w-full px-5 text-sm font-semibold sm:w-auto" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            保存更改
            </Button>
          </div>
        </form>
      )}
    </SettingsSubpageShell>
  );
}
