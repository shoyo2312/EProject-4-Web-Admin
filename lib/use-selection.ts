"use client";

import { useState } from "react";

/** The ticked rows of a table. An id that leaves the page stops counting once the table filters by what it shows. */
export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  return {
    selected,
    toggle: (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    set: (ids: readonly string[]) => setSelected(new Set(ids)),
    clear: () => setSelected(new Set()),
  };
}

export type Selection = ReturnType<typeof useSelection>;
