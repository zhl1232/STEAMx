"use client";

import { useState } from "react";
import Image from "next/image";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface HeroImagePreviewProps {
  heroImage: string;
  displayTitle: string;
}

export function HeroImagePreview({ heroImage, displayTitle }: HeroImagePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <div className="relative aspect-5/4 overflow-hidden bg-muted/30 sm:aspect-16/10 md:aspect-video">
          <Image
            src={heroImage}
            alt={displayTitle}
            fill
            priority
            sizes="(min-width: 1280px) 1120px, 100vw"
            className="object-contain transition duration-500 hover:scale-[1.01]"
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent" />
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs text-white/85 backdrop-blur-sm">
            点击查看原图
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 border-0 bg-black/96 p-0 shadow-none [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:text-white sm:left-[50%] sm:top-[50%] sm:h-[92vh] sm:w-[92vw] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-xl sm:border sm:border-white/10">
          <DialogTitle className="sr-only">观察照片预览</DialogTitle>
          <DialogDescription className="sr-only">在弹层中查看完整观察照片，无需下载。</DialogDescription>

          <div className="relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]">
            <div className="relative h-full w-full">
              <Image
                src={heroImage}
                alt={displayTitle}
                fill
                className="object-contain p-6 sm:p-10"
                sizes="100vw"
                priority
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
