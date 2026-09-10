"use client";

import { useEffect, useState } from "react";

/**
 * True below Tailwind's `xl` (1280px). Below this the admin data tables trade
 * their secondary columns for a tap-to-expand detail row — `xl` not `lg`
 * because the 260px sidebar leaves only ~970px at 1280px, short of what the
 * wide tables need (Uploads ~1100px) so they would otherwise scroll sideways.
 */
export function useBelowXl() {
  const [below, setBelow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const sync = () => setBelow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return below;
}
