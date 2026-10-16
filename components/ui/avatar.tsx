"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  lg: "h-14 w-14 text-[16px]",
} as const;

/**
 * A round avatar, or the initials over a neutral fill when there is no image — and when the image
 * fails: a bare `<img>` cannot recover from a CDN url that 404s, it shows the broken-image icon.
 *
 * A plain img rather than next/image: avatars come from arbitrary CDN hosts that next/image would
 * have to be configured for one by one, and a broken avatar must not fail a moderation row.
 */
export function Avatar({
  src,
  initials,
  size = "sm",
}: {
  src: string | null | undefined;
  initials: string;
  size?: keyof typeof SIZES;
}) {
  // The url that failed rather than a flag, so a different url gets its own try.
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-muted font-semibold text-ink-soft uppercase",
        SIZES[size],
      )}
    >
      {src && src !== failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
