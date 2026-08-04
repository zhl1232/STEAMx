"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Bug, ChevronLeft, ChevronRight, Feather, ImageOff, TreePine } from "lucide-react";
import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { NatureTopicKey } from "@/lib/config/nature-topics";
import { resolveAssetDisplayUrl, shouldBypassAssetDisplayOptimization } from "@/lib/utils/asset-url";

export interface SpeciesImageGalleryItem {
  url: string;
  observationHref?: string;
  observationAuthor?: string | null;
}

interface SpeciesImageGalleryProps {
  imageItems: SpeciesImageGalleryItem[];
  speciesName: string;
  scientificName?: string | null;
  speciesNamePinyin?: string | null;
  topicKey?: NatureTopicKey | null;
}

interface SpeciesImageFallbackProps {
  speciesName: string;
  scientificName?: string | null;
  speciesNamePinyin?: string | null;
  topicKey?: NatureTopicKey | null;
}

function SpeciesImageFallback({
  speciesName,
  scientificName,
  speciesNamePinyin,
  topicKey,
}: SpeciesImageFallbackProps) {
  const Icon =
    topicKey === "birds"
      ? Feather
      : topicKey === "plants"
        ? TreePine
        : topicKey === "insects"
          ? Bug
          : ImageOff;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(var(--surface-muted)/0.72)] px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.88)] text-[hsl(var(--brand-green))] shadow-xs">
        <Icon className="h-8 w-8" strokeWidth={1.7} aria-hidden />
      </div>
      <p className="mt-4 text-xs font-semibold text-muted-foreground">暂无图片</p>
      {speciesNamePinyin ? (
        <p className="mt-3 text-[11px] font-medium text-[hsl(var(--brand-green))]">
          {speciesNamePinyin}
        </p>
      ) : null}
      <p className="mt-1 max-w-full break-words text-lg font-semibold text-foreground">{speciesName}</p>
      {scientificName ? (
        <p className="mt-1 max-w-full truncate text-xs italic text-muted-foreground">
          {scientificName}
        </p>
      ) : null}
    </div>
  );
}

export function SpeciesImageGallery({
  imageItems,
  speciesName,
  scientificName,
  speciesNamePinyin,
  topicKey,
}: SpeciesImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const [loadedMainImageUrls, setLoadedMainImageUrls] = useState<Set<string>>(() => new Set());
  const [loadedThumbnailUrls, setLoadedThumbnailUrls] = useState<Set<string>>(() => new Set());
  const railRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const availableImageItems = imageItems.filter((image) => !failedImageUrls.has(image.url));
  const boundedActiveIndex = Math.min(activeIndex, Math.max(availableImageItems.length - 1, 0));
  const activeImageItem = availableImageItems[boundedActiveIndex];
  const activeImageUrl = activeImageItem?.url;
  const activeImageSrc = activeImageUrl
    ? resolveAssetDisplayUrl(activeImageUrl) ?? activeImageUrl
    : null;
  const isActiveImageLoaded = activeImageUrl
    ? loadedMainImageUrls.has(activeImageUrl)
    : false;
  const hasManyImages = availableImageItems.length > 5;

  function handleImageError(imageUrl: string) {
    setFailedImageUrls((current) => {
      if (current.has(imageUrl)) return current;
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  }

  function markImageLoaded(
    imageUrl: string,
    setLoadedImageUrls: Dispatch<SetStateAction<Set<string>>>,
  ) {
    setLoadedImageUrls((current) => {
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
      <div
        className={`relative overflow-hidden bg-muted/40 sm:rounded-lg sm:border sm:border-border/70 sm:shadow-xs ${
          activeImageUrl && activeImageSrc
            ? "aspect-4/3 min-h-[220px] sm:aspect-[1.42] lg:aspect-[1.34]"
            : "h-[240px] sm:h-[320px] lg:h-[360px]"
        }`}
      >
        <SpeciesImageFallback
          speciesName={speciesName}
          scientificName={scientificName}
          speciesNamePinyin={speciesNamePinyin}
          topicKey={topicKey}
        />
        {activeImageUrl && activeImageSrc ? (
          <Image
            key={activeImageUrl}
            src={activeImageSrc}
            alt={speciesName}
            fill
            className={`object-cover transition-opacity duration-200 ${
              isActiveImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            sizes="(max-width: 1024px) 100vw, 660px"
            quality={72}
            priority
            unoptimized={shouldBypassAssetDisplayOptimization(activeImageUrl)}
            onLoad={() => markImageLoaded(activeImageUrl, setLoadedMainImageUrls)}
            onError={() => handleImageError(activeImageUrl)}
          />
        ) : null}
        {/* 移动端图片计数器 */}
        {availableImageItems.length > 1 ? (
          <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs lg:hidden">
            {boundedActiveIndex + 1}/{availableImageItems.length}
          </div>
        ) : null}
      </div>

      {activeImageItem?.observationHref ? (
        <div className="mt-2 flex min-w-0 items-center justify-between gap-3 px-4 sm:px-0">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            用户观察 · <span className="font-semibold text-foreground">{activeImageItem.observationAuthor || "匿名观察者"}</span>
          </p>
          <Link
            href={activeImageItem.observationHref}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-xs px-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/8 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            查看观察记录
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      {availableImageItems.length > 1 ? (
        <div className="mt-3 flex items-center gap-2 px-4 sm:px-0">
          {availableImageItems.length > 5 ? (
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
            {availableImageItems.map((image, index) => {
              const imageSrc = resolveAssetDisplayUrl(image.url) ?? image.url;

              return (
                <button
                  key={`${image.url}-${index}`}
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
                  aria-label={`查看${speciesName}图片 ${index + 1}${image.observationHref ? "，用户观察照片" : ""}`}
                  aria-pressed={index === boundedActiveIndex}
                >
                  <ImageOff
                    className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/55"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <Image
                    src={imageSrc}
                    alt={`${speciesName} 图片 ${index + 1}`}
                    fill
                    className={`object-cover transition-opacity duration-200 ${
                      loadedThumbnailUrls.has(image.url) ? "opacity-100" : "opacity-0"
                    }`}
                    sizes="72px"
                    quality={48}
                    unoptimized={shouldBypassAssetDisplayOptimization(image.url)}
                    onLoad={() => markImageLoaded(image.url, setLoadedThumbnailUrls)}
                    onError={() => handleImageError(image.url)}
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
