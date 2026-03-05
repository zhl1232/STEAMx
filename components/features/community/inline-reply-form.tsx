"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";

export interface InlineReplyFormProps {
  replyId: number;
  replyAuthor: string;
  replyUserId?: string;
  userAvatar?: string;
  userAvatarFrameId?: string;
  onSubmit: (
    e: React.FormEvent,
    content: string,
    parentId: number,
    replyToUserId?: string,
    replyToUsername?: string,
  ) => void;
  onCancel: () => void;
}

export const InlineReplyForm = React.memo(function InlineReplyForm({
  replyId,
  replyAuthor,
  replyUserId,
  userAvatar,
  userAvatarFrameId,
  onSubmit,
  onCancel,
}: InlineReplyFormProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  return (
    <div className="mt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const content = textareaRef.current?.value || "";
          if (!content.trim()) return;
          onSubmit(e, content, replyId, replyUserId, replyAuthor);
          if (textareaRef.current) {
            textareaRef.current.value = "";
          }
        }}
        className="flex gap-3 items-start"
      >
        <AvatarWithFrame
          src={userAvatar}
          fallback="M"
          avatarFrameId={userAvatarFrameId}
          className="h-8 w-8 shrink-0"
        />
        <div className="flex-1 space-y-2">
          <textarea
            ref={textareaRef}
            placeholder={`回复 @${replyAuthor}...`}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8">
              取消
            </Button>
            <Button type="submit" size="sm" className="h-8">
              发布
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
});
