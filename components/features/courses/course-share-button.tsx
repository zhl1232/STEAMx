"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShareCourseData } from "@/components/features/works/share-work-dialog";

const ShareCourseDialog = dynamic(
  () => import("@/components/features/works/share-work-dialog").then((module) => module.ShareCourseDialog),
  { ssr: false },
);

/** 分享卡片会拉进 modern-screenshot + qrcode.react，点开才加载 */
export function CourseShareButton({ course }: { course: ShareCourseData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        shape="pill"
        size="lg"
        className="gap-2 font-bold"
        onClick={() => setOpen(true)}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        分享给家长
      </Button>
      {open ? <ShareCourseDialog course={course} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
