"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AdminVideoResponse } from "@/lib/api/types";

/**
 * Fills the viewport with the video. Rendered through a portal because a table row is
 * not a place to put a fixed overlay, and closed on Escape or a backdrop click so a
 * reviewer never has to reach for the mouse to get back to the worklist.
 */
export function WatchOverlay({
  video,
  onClose,
}: {
  video: AdminVideoResponse;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${video.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-9 right-0 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-[12px] text-white transition-colors hover:bg-black/60"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
        <video
          key={video.id}
          src={video.hlsUrl ?? undefined}
          poster={video.thumbnailUrl ?? undefined}
          controls
          autoPlay
          className="max-h-[80vh] w-full rounded-lg bg-black"
        />
        <p className="mt-2 truncate text-[12px] text-white/70" title={video.title}>
          {video.title}
        </p>
      </div>
    </div>,
    document.body,
  );
}
