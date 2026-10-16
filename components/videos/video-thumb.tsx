"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A video's poster frame at list size, so a row can be recognised at a glance instead of by its
 * title alone. Falls back to a film glyph when there is no thumbnail or its url is dead — a
 * broken-image icon in every row reads as a broken console.
 */
export function VideoThumb({ src, className }: { src: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-bg text-ink-faint",
        className,
      )}
    >
      {src && !broken ? (
        // A plain img: thumbnails come from whichever storage host the environment uses, which
        // next/image would have to be configured for one by one.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Film className="h-3.5 w-3.5" />
      )}
    </span>
  );
}
