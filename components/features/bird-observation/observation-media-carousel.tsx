"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { SwipeablePhotoViewer } from "@/components/features/bird-observation/swipeable-photo-viewer";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useHorizontalSwipe } from "@/hooks/use-horizontal-swipe";
import { cn } from "@/lib/utils";

interface ObservationMediaCarouselProps {
  mediaUrls: string[];
  alt: string;
}

const previewSlideTransition = { type: "tween" as const, duration: 0.26, ease: [0.32, 0.72, 0, 1] };

const previewSlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "72%" : "-72%",
    opacity: 0.2,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-72%" : "72%",
    opacity: 0.2,
    scale: 0.96,
  }),
};

export function ObservationMediaCarousel({ mediaUrls, alt }: ObservationMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDirection, setPreviewDirection] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  const scrollRailTo = useCallback((index: number) => {
    railRef.current?.scrollTo({
      left: index * 120,
      behavior: "smooth",
    });
  }, []);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const count = mediaUrls.length;
      if (nextIndex === activeIndex) return;
      const forward = (nextIndex - activeIndex + count) % count;
      const backward = (activeIndex - nextIndex + count) % count;
      const direction = forward <= backward ? 1 : -1;
      setPreviewDirection(direction);
      setActiveIndex(nextIndex);
      scrollRailTo(nextIndex);
    },
    [activeIndex, mediaUrls.length, scrollRailTo],
  );

  const shiftImage = useCallback(
    (delta: number) => {
      const count = mediaUrls.length;
      setPreviewDirection(delta);
      setActiveIndex((current) => {
        const wrapped = (current + delta + count) % count;
        queueMicrotask(() => scrollRailTo(wrapped));
        return wrapped;
      });
    },
    [mediaUrls.length, scrollRailTo],
  );

  const previewSwipe = useHorizontalSwipe({
    enabled: mediaUrls.length > 1,
    onSwipeLeft: () => shiftImage(1),
    onSwipeRight: () => shiftImage(-1),
  });

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
          alt={alt}
          priority
          showCounter
          onTap={() => setPreviewOpen(true)}
          className="aspect-[4/3] min-h-[220px] bg-muted/40 sm:aspect-[16/10] lg:aspect-[1.2]"
          sizes="(max-width: 1024px) 100vw, 900px"
        />
      </div>

      {mediaUrls.length > 1 ? (
        <div
          ref={railRef}
          className="mt-3 flex gap-2 overflow-x-auto scroll-smooth px-8 pb-1 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
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
                  ? "scale-[1.02] border-[hsl(var(--nature-accent))] shadow-sm"
                  : "border-border/70 opacity-80 hover:opacity-100",
              )}
            >
              <Image src={url} alt="" fill className="object-cover" sizes="72px" />
            </button>
          ))}
        </div>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 border-0 bg-black/96 p-0 shadow-none [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:text-white sm:left-[50%] sm:top-[50%] sm:h-[92vh] sm:w-[92vw] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-xl sm:border sm:border-white/10">
          <DialogTitle className="sr-only">观察照片预览</DialogTitle>
          <DialogDescription className="sr-only">在弹层中查看完整观察照片。</DialogDescription>
          <div
            className="relative flex h-full w-full touch-pan-y items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]"
            onTouchStart={previewSwipe.onTouchStart}
            onTouchEnd={previewSwipe.onTouchEnd}
          >
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute left-5 top-5 z-10 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur"
            >
              {activeIndex + 1} / {mediaUrls.length}
            </motion.div>
            {mediaUrls.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => shiftImage(-1)}
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-3 text-white backdrop-blur transition hover:bg-black/65"
                  aria-label="上一张"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftImage(1)}
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-3 text-white backdrop-blur transition hover:bg-black/65"
                  aria-label="下一张"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
            <AnimatePresence initial={false} custom={previewDirection} mode="popLayout">
              <motion.div
                key={`${activeUrl}-${activeIndex}`}
                custom={previewDirection}
                variants={previewSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={previewSlideTransition}
                className="absolute inset-0"
              >
                <Image
                  src={activeUrl}
                  alt={`${alt}（${activeIndex + 1}/${mediaUrls.length}）`}
                  fill
                  className="object-contain p-6 sm:p-10"
                  sizes="100vw"
                  priority
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
