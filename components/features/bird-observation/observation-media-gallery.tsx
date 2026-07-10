"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ObservationPhotoFrame } from "@/components/features/bird-observation/observation-photo-frame";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ObservationMediaGalleryProps {
  mediaUrls: string[];
}

export function ObservationMediaGallery({ mediaUrls }: ObservationMediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (mediaUrls.length === 0) {
    return null;
  }

  const selectedUrl = selectedIndex != null ? mediaUrls[selectedIndex] : null;
  const canGoPrev = selectedIndex != null && selectedIndex > 0;
  const canGoNext = selectedIndex != null && selectedIndex < mediaUrls.length - 1;

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mediaUrls.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className="group overflow-hidden rounded-md border border-border/70 bg-background/80 text-left transition hover:border-primary/40"
          >
            <ObservationPhotoFrame
              src={url}
              alt={`观察照片 ${index + 1}`}
              className="h-64 sm:h-72"
              imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </button>
        ))}
      </div>

      <Dialog open={selectedIndex != null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 border-0 bg-black/96 p-0 shadow-none [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:text-white sm:left-[50%] sm:top-[50%] sm:h-[92vh] sm:w-[92vw] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-xl sm:border sm:border-white/10">
          <DialogTitle className="sr-only">观察照片预览</DialogTitle>
          <DialogDescription className="sr-only">在弹层中查看完整观察照片，无需下载。</DialogDescription>

          {selectedUrl ? (
            <div className="relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]">
              <div className="absolute left-5 top-5 z-10 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                {selectedIndex! + 1} / {mediaUrls.length}
              </div>

              {mediaUrls.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => canGoPrev && setSelectedIndex((value) => (value == null ? value : value - 1))}
                    disabled={!canGoPrev}
                    className={cn(
                      "absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-3 text-white backdrop-blur-sm transition",
                      canGoPrev ? "hover:bg-black/65" : "cursor-not-allowed opacity-35"
                    )}
                    aria-label="上一张图片"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => canGoNext && setSelectedIndex((value) => (value == null ? value : value + 1))}
                    disabled={!canGoNext}
                    className={cn(
                      "absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-3 text-white backdrop-blur-sm transition",
                      canGoNext ? "hover:bg-black/65" : "cursor-not-allowed opacity-35"
                    )}
                    aria-label="下一张图片"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}

              <div className="relative h-full w-full">
                <Image
                  src={selectedUrl}
                  alt={`观察照片 ${selectedIndex! + 1}`}
                  fill
                  className="object-contain p-6 sm:p-10"
                  sizes="100vw"
                  priority
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
