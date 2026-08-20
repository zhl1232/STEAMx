"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { uploadCommentImage, CommentImageError } from "@/lib/comment-image";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Profile, ReplyTarget } from "@/lib/mappers/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface BottomReplyBoxProps {
  user: SupabaseUser | null;
  profile: Profile | null;
  replyTarget?: ReplyTarget | null;
  /** Default target for Sheet variant (e.g. root comment author) */
  defaultTarget?: ReplyTarget | null;
  onCancelReply?: () => void;
  canUploadImage?: boolean;
  /**
   * "fixed": page-level sticky/fixed bottom bar (default).
   * "sheet": flush bottom inside a Sheet, no fixed positioning.
   * "inline": flow with page content, suitable below a comment list.
   */
  variant?: "fixed" | "sheet" | "inline";
  /** Slot rendered to the right when not focused (e.g. like/share buttons) */
  actionsSlot?: React.ReactNode;
  /** Fixed composer placement: above global bottom nav, or directly at the screen bottom. */
  fixedPlacement?: "aboveNav" | "screen";
  /** Render fixed composer under document.body so it is independent of page section layout. */
  portalFixed?: boolean;
  /** Default placeholder when no reply target is active */
  placeholder?: string;
  onSubmit: (
    e: React.FormEvent,
    content: string,
    parentId?: number,
    replyToUserId?: string,
    replyToUsername?: string,
    imageUrl?: string,
  ) => void;
}

export const BottomReplyBox = React.memo(function BottomReplyBox({
  user,
  profile,
  replyTarget,
  defaultTarget,
  onCancelReply,
  canUploadImage = false,
  variant = "fixed",
  actionsSlot,
  fixedPlacement = "aboveNav",
  portalFixed = false,
  placeholder: defaultPlaceholder = "分享你的观点...",
  onSubmit,
}: BottomReplyBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  const [hasContent, setHasContent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  const activeTarget = replyTarget ?? defaultTarget ?? null;
  const isOverridden = replyTarget != null && defaultTarget != null
    && String(replyTarget.id) !== String(defaultTarget.id);
  const showCancelTag = variant !== "sheet" ? replyTarget != null : isOverridden;

  const placeholder = showCancelTag && activeTarget
    ? "输入回复内容..."
    : activeTarget
      ? `回复 @${activeTarget.author}...`
      : defaultPlaceholder;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "图片大小不能超过 2MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    if (textareaRef.current) textareaRef.current.value = "";
    setHasContent(false);
    clearImage();
    setIsFocused(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = textareaRef.current?.value || "";
    if (!content.trim() && !imageFile) return;

    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile && user) {
        try {
          imageUrl = await uploadCommentImage(imageFile, user.id);
        } catch (err) {
          toast({
            title: err instanceof CommentImageError ? err.message : "图片上传失败",
            variant: "destructive",
          });
          return;
        }
      }

      if (activeTarget) {
        onSubmit(e, content, Number(activeTarget.id), activeTarget.userId, activeTarget.author, imageUrl);
      } else {
        onSubmit(e, content, undefined, undefined, undefined, imageUrl);
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const hasReplyTarget = variant !== "sheet" ? replyTarget != null : (activeTarget != null);
  const isExpanded = isFocused || hasContent || !!imageFile || hasReplyTarget;

  React.useEffect(() => {
    if (replyTarget && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTarget]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const wrapperClass = variant === "fixed"
    ? cn(
      "fixed left-0 right-0 z-40 border-t border-border/80 bg-background/95 px-4 pt-3 shadow-[0_-1px_0_0_rgba(0,0,0,0.06),0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur-sm supports-backdrop-filter:bg-background/60 dark:border-border dark:shadow-[0_-1px_0_0_rgba(255,255,255,0.06),0_-4px_12px_rgba(0,0,0,0.2)] md:sticky md:bottom-0 md:border-t-0 md:py-3 md:shadow-none",
      portalFixed && "md:hidden",
      fixedPlacement === "screen"
        ? "bottom-0 pb-[calc(0.65rem+env(safe-area-inset-bottom))]"
        : "bottom-[calc(4rem+env(safe-area-inset-bottom))] pb-3",
    )
    : variant === "inline"
      ? "rounded-(--radius-lg) border border-border/70 bg-background/85 px-4 py-4 shadow-xs shadow-black/5"
      : "shrink-0 border-t bg-background px-4 py-3";

  const content = (
    <div className={wrapperClass}>
      <div className="max-w-4xl mx-auto w-full">
        <div className={cn("flex gap-3", isExpanded ? "items-start" : "items-center")}>
          <UserAvatar
            userId={user?.id}
            name={profile?.display_name}
            src={profile?.avatar_url}
            href={null}
            fallback={profile?.display_name?.[0]?.toUpperCase() || "U"}
            avatarFrameId={profile?.equipped_avatar_frame_id}
            className={cn("border shadow-xs shrink-0", isExpanded ? "h-9 w-9 mt-0.5" : "h-8 w-8")}
            avatarClassName={isExpanded ? "h-9 w-9" : "h-8 w-8"}
          />

          <form onSubmit={handleSubmit} className="flex-1 min-w-0">
            {canUploadImage && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageSelect}
              />
            )}
            <div
              className={cn(
                "w-full min-w-0 overflow-hidden transition-all duration-200 ease-out",
                isExpanded
                  ? "rounded-sm bg-[#F0F2F5] dark:bg-muted/90 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20"
                  : "rounded-full bg-muted/40 dark:bg-muted/50 border border-border/60",
              )}
            >
              {isExpanded ? (
                <>
                  {showCancelTag && activeTarget && (
                    <div className="flex items-center gap-1.5 px-3 pt-2 text-xs">
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        回复 @{activeTarget.author}
                        <button
                          type="button"
                          onClick={onCancelReply}
                          className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    placeholder={placeholder}
                    rows={1}
                    onChange={(e) => setHasContent(e.target.value.trim().length > 0)}
                    onCompositionStart={() => { isComposingRef.current = true; }}
                    onCompositionEnd={() => { isComposingRef.current = false; }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      if (!textareaRef.current?.value && !imageFile) {
                        setIsFocused(false);
                        if (onCancelReply) onCancelReply();
                      }
                    }}
                    className="py-3 px-4 w-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-hidden resize-none leading-normal min-h-[80px] max-h-[200px]"
                  />
                </>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setIsFocused(true);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="py-2 px-4 h-[36px] flex items-center text-sm text-muted-foreground cursor-pointer select-none"
                >
                  {placeholder}
                </div>
              )}
              {isExpanded && (
                <>
                  {imagePreview && (
                    <div className="px-3 pb-2">
                      <div className="relative inline-block">
                        <Image
                          src={imagePreview}
                          alt="待发送图片"
                          width={72}
                          height={72}
                          className="rounded-xs border border-border/60 object-cover h-[72px] w-[72px]"
                        />
                        <button
                          type="button"
                          onClick={clearImage}
                          className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-foreground/70 text-background flex items-center justify-center hover:bg-foreground/90 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center">
                      {canUploadImage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                          aria-label="插入图片"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => fileInputRef.current?.click()}
                          title="插入图片 (Lv.2 特权)"
                        >
                          <ImagePlus className="h-4.5 w-4.5" aria-hidden />
                        </Button>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={(!hasContent && !imageFile) || submitting}
                      size="sm"
                      className="h-9 px-4 rounded-full text-xs font-medium"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "发布"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </form>

          {variant === "fixed" && !isExpanded && actionsSlot != null && (
            <>
              <div className="min-w-2 shrink-0" aria-hidden />
              <div className="shrink-0 flex items-center">{actionsSlot}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (variant === "fixed" && portalFixed) {
    return mounted ? createPortal(content, document.body) : null;
  }

  return content;
});
