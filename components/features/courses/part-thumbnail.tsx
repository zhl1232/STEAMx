import Image from "next/image";
import { getPartThumbnail } from "@/lib/courses/part-thumbnails";

/** Decorative image beside the part name; the dot indicates the requested colour. */
export function PartThumbnail({
  partId,
  colorCode,
  colorHex,
  size = 40,
}: {
  partId: string;
  colorCode: number;
  colorHex: string;
  size?: 40 | 44;
}) {
  const thumb = getPartThumbnail(partId, colorCode);
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white"
      style={{ width: size, height: size }}
    >
      {thumb ? (
        <Image src={thumb.src} alt="" width={size} height={size} unoptimized className="h-full w-full object-contain" />
      ) : (
        <span className="h-7 w-7 rounded-sm border border-black/15" style={{ backgroundColor: colorHex }} />
      )}
      {thumb && !thumb.exactColor ? (
        <span
          className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border border-white"
          style={{ backgroundColor: colorHex }}
        />
      ) : null}
    </span>
  );
}
