"use client";

import { useState } from "react";

/**
 * What an expandable table row shows once it is opened: fetched the first time and kept for the
 * next open, since what a row points at does not change while the admin scans the table.
 *
 * A failed fetch is remembered as failed, not as empty, and is tried again on the next open or on
 * `retry`. Empty is what a clean record looks like — "0 reports, no actions recorded" — and a
 * lookup that never answered is not one.
 */
export function useRowDetail<T>(load: () => Promise<T>) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  function fetchDetail() {
    setLoading(true);
    setFailed(false);
    load()
      .then((value) => setData(value))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  return {
    open,
    data,
    loading,
    failed,
    toggle() {
      const opening = !open;
      setOpen(opening);
      if (opening && data === null && !loading) fetchDetail();
    },
    retry: fetchDetail,
  };
}
