/** The first request opens a window; everything inside it becomes the one refresh at its end. */
export function createRefreshScheduler({
  refresh,
  windowMs = 1000,
}: {
  refresh: () => void;
  windowMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    request() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, windowMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
