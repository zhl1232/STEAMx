"use client";

import { useCallback, useRef, useState } from "react";

import { ImageLightbox } from "@/components/features/shared/image-lightbox";
import { SwipeablePhotoViewer } from "@/components/features/shared/swipeable-photo-viewer";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

interface ObservationMediaCarouselProps {
  mediaUrls: string[];
  alt: string;
}

export function ObservationMediaCarousel({ mediaUrls, alt }: ObservationMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const goToIndex = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
    railRef.current?.children[nextIndex]?.scrollIntoView?.({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, []);

  const activeUrl = mediaUrls[activeIndex] ?? mediaUrls[0];

  if (!activeUrl) {
    return null;
  }

  return (
    <>
      <div className="relative">
        <SwipeablePhotoViewer
          urls={mediaUrls}
          index={activeIndex}
          onIndexChange={goToIndex}
          alt={`${alt}，点击查看大图`}
          priority
          showCounter
          onTap={() => setPreviewOpen(true)}
          className="aspect-4/3 min-h-[220px] bg-muted/40 sm:aspect-16/10 lg:aspect-[1.2]"
          sizes="(max-width: 1024px) 100vw, 900px"
        />
      </div>

      {mediaUrls.length > 1 ? (
        <div
          ref={railRef}
          className="mt-3 flex gap-2 overflow-x-auto scroll-smooth px-8 pb-1 scrollbar-none md:px-0 [&::-webkit-scrollbar]:hidden"
          aria-label="观察照片缩略图"
        >
          {mediaUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => goToIndex(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xs border-2 transition-all duration-200 sm:h-[72px] sm:w-[72px]",
                index === activeIndex
                  ? "scale-[1.02] border-[hsl(var(--primary))] shadow-xs"
                  : "border-border/70 opacity-80 hover:opacity-100",
              )}
            >
              <OptimizedImage
                src={url}
                alt=""
                fill
                variant="thumbnail"
                loading={index === activeIndex ? "eager" : "lazy"}
                className="object-cover"
                sizes="72px"
              />
            </button>
          ))}
        </div>
      ) : null}

      <ImageLightbox
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        images={mediaUrls}
        index={activeIndex}
        onIndexChange={goToIndex}
        alt={alt}
        title="观察照片预览"
        description="左右滑动切换观察照片，双指缩放查看细节，下滑关闭。"
      />
    </>
  );
}
