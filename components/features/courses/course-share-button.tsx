"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShareCourseData } from "@/components/features/works/share-work-dialog";

const ShareCourseDialog = dynamic(
  () => import("@/components/features/works/share-work-dialog").then((module) => module.ShareCourseDialog),
  { ssr: false },
);

/** 分享卡片会拉进 modern-screenshot + qrcode.react，点开才加载 */
export function CourseShareButton({
  course,
  className,
}: {
  course: ShareCourseData;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        shape="pill"
        className={cn(
          "gap-2 border border-border/70 bg-secondary/80 font-bold text-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-[0.98]",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        分享
      </Button>
      {open ? <ShareCourseDialog course={course} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
