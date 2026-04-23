import Image from "next/image";

import { cn } from "@/lib/utils";

interface ObservationPhotoFrameProps {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  paddingClassName?: string;
}

export function ObservationPhotoFrame({
  src,
  alt,
  sizes,
  priority = false,
  className,
  imageClassName,
  paddingClassName = "p-3",
}: ObservationPhotoFrameProps) {
  return (
    <div className={cn("relative overflow-hidden bg-muted/25", className)}>
      <Image
        src={src}
        alt=""
        fill
        aria-hidden="true"
        className="scale-110 object-cover blur-2xl opacity-55"
        sizes={sizes}
        priority={priority}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.22),_transparent_48%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-black/8 to-transparent" />
      <Image
        src={src}
        alt={alt}
        fill
        className={cn("object-contain", paddingClassName, imageClassName)}
        sizes={sizes}
        priority={priority}
      />
    </div>
  );
}
