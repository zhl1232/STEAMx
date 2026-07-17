"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { resolveAssetDisplayUrl, shouldBypassAssetDisplayOptimization } from "@/lib/utils/asset-url";

interface SpeciesImageGalleryProps {
  imageUrls: string[];
  speciesName: string;
}

export function SpeciesImageGallery({ imageUrls, speciesName }: SpeciesImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const railRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const availableImageUrls = imageUrls.filter((imageUrl) => !failedImageUrls.has(imageUrl));
  const boundedActiveIndex = Math.min(activeIndex, Math.max(availableImageUrls.length - 1, 0));
  const activeImageUrl = availableImageUrls[boundedActiveIndex];
  const activeImageSrc = activeImageUrl
    ? resolveAssetDisplayUrl(activeImageUrl) ?? activeImageUrl
    : null;
  const hasManyImages = availableImageUrls.length > 5;

  function handleImageError(imageUrl: string) {
    setFailedImageUrls((current) => {
      if (current.has(imageUrl)) return current;
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  }

  function selectImage(index: number) {
    setActiveIndex(index);
    thumbnailRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function scrollThumbnails(direction: "previous" | "next") {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction === "next" ? rail.clientWidth * 0.72 : -rail.clientWidth * 0.72,
      behavior: "smooth",
    });
  }

  return (
    <div className="min-w-0">
      <div className="relative aspect-4/3 min-h-[220px] overflow-hidden bg-muted/40 sm:rounded-lg sm:border sm:border-border/70 sm:shadow-xs sm:aspect-[1.42] lg:aspect-[1.34]">
        {activeImageUrl && activeImageSrc ? (
          <Image
            key={activeImageUrl}
            src={activeImageSrc}
            alt={speciesName}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 660px"
            quality={72}
            priority
            unoptimized={shouldBypassAssetDisplayOptimization(activeImageUrl)}
            onError={() => handleImageError(activeImageUrl)}
          />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
            暂无可用图片
          </div>
        )}
        {/* 移动端图片计数器 */}
        {availableImageUrls.length > 1 ? (
          <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs lg:hidden">
            {boundedActiveIndex + 1}/{availableImageUrls.length}
          </div>
        ) : null}
      </div>

      {availableImageUrls.length > 1 ? (
        <div className="mt-3 flex items-center gap-2 px-4 sm:px-0">
          {hasManyImages ? (
            <button
              type="button"
              onClick={() => scrollThumbnails("previous")}
              className="hidden h-16 w-10 shrink-0 place-items-center rounded-sm border border-border/70 bg-background/80 text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary sm:grid sm:h-[72px]"
              aria-label="向左浏览图片"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div
            ref={railRef}
            className="flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
            aria-label={`${speciesName} 图集`}
          >
            {availableImageUrls.map((imageUrl, index) => {
              const imageSrc = resolveAssetDisplayUrl(imageUrl) ?? imageUrl;

              return (
                <button
                  key={`${imageUrl}-${index}`}
                  ref={(node) => {
                    thumbnailRefs.current[index] = node;
                  }}
                  type="button"
                  onClick={() => selectImage(index)}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xs border bg-muted/40 shadow-xs transition sm:h-[72px] sm:w-[72px] sm:rounded-sm ${
                    index === boundedActiveIndex
                      ? "border-primary ring-2 ring-primary/18"
                      : "border-border/70 hover:border-primary/50"
                  }`}
                  aria-label={`查看${speciesName}图片 ${index + 1}`}
                  aria-pressed={index === boundedActiveIndex}
                >
                  <Image
                    src={imageSrc}
                    alt={`${speciesName} 图片 ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="72px"
                    quality={48}
                    unoptimized={shouldBypassAssetDisplayOptimization(imageUrl)}
                    onError={() => handleImageError(imageUrl)}
                  />
                </button>
              );
            })}
          </div>

          {hasManyImages ? (
            <button
              type="button"
              onClick={() => scrollThumbnails("next")}
              className="grid h-16 w-10 shrink-0 place-items-center rounded-sm border border-border/70 bg-background/80 text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary sm:h-[72px]"
              aria-label="向右浏览图片"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
