"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/mappers/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface BottomReplyBoxProps {
  user: SupabaseUser | null;
  profile: Profile | null;
  replyingTo: number | null;
  onSubmit: (e: React.FormEvent, content: string) => void;
}

export const BottomReplyBox = React.memo(function BottomReplyBox({
  user,
  profile,
  replyingTo,
  onSubmit,
}: BottomReplyBoxProps) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const isComposingRef = React.useRef(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || replyingTo !== null) return;
    onSubmit(e, content);
    setContent("");
  };

  const isExpanded = isFocused || content.length > 0;

  return (
    <div className="fixed bottom-16 left-0 right-0 md:sticky md:bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3 sm:py-4 border-t border-border/80 md:border-t-0 px-4 md:px-0 shadow-[0_-1px_0_0_rgba(0,0,0,0.06),0_-4px_12px_rgba(0,0,0,0.04)] md:shadow-none md:mt-8">
      <div className="flex gap-3 sm:gap-4 max-w-4xl mx-auto w-full">
        <AvatarWithFrame
          src={profile?.avatar_url || user?.user_metadata?.avatar_url}
          fallback={profile?.display_name?.[0]?.toUpperCase() || "U"}
          avatarFrameId={profile?.equipped_avatar_frame_id}
          className="h-9 w-9 sm:h-10 sm:w-10 border shadow-sm shrink-0"
        />
        <form onSubmit={handleSubmit} className="flex-1 relative">
          <div
            className={cn(
              "rounded-xl border bg-background overflow-hidden transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary/20",
              isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md",
            )}
          >
            <Textarea
              ref={textareaRef}
              placeholder={
                replyingTo !== null ? "正在回复他人，请在上方回复框中输入..." : "分享你的观点..."
              }
              value={replyingTo === null ? content : ""}
              onChange={handleChange}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(e: React.CompositionEvent<HTMLTextAreaElement>) => {
                isComposingRef.current = false;
                setContent((e.target as HTMLTextAreaElement).value);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                if (!content) setIsFocused(false);
              }}
              disabled={replyingTo !== null}
              className="min-h-[44px] border-none resize-none focus-visible:ring-0 p-3 text-sm bg-transparent"
            />
            {isExpanded && (
              <div className="flex justify-between items-center px-3 pb-2">
                <div className="text-xs text-muted-foreground" />
                <Button
                  type="submit"
                  disabled={!content.trim() || replyingTo !== null}
                  className="h-7 px-4 rounded-full text-xs"
                >
                  发布
                </Button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
});
