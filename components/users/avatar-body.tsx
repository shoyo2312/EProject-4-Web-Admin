"use client";

import { useState } from "react";

/**
 * A plain `<img>` cannot fall back to anything on its own when the CDN url 404s or the host is
 * down — it just shows the browser's broken-image icon. This drops back to the initials on
 * `onError`, same as a missing avatarUrl.
 */
export function AvatarBody({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!avatarUrl || broken) return <>{initials}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}
