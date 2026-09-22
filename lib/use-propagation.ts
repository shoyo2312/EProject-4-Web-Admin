"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * When to re-read after a successful enforcement, in milliseconds from the submit.
 *
 * The write is not the state change: admin-service records the action and publishes it, and the
 * service that owns the row (video-service, auth-service, interaction-service) applies it only
 * when it consumes the event — so a refetch fired the instant the POST returns reliably reads the
 * old state back. Bounded rather than a live poll: if it has not landed inside this window
 * something is wrong with the pipeline, and retrying forever would hide that rather than show it.
 */
const REFRESH_AT = [900, 2500, 6000];
const GIVE_UP_AT = 9000;

/**
 * Watches for an enforcement to come back from the owning service.
 *
 * `current` is what the row shows *now*; `watch()` remembers it as the value the action is moving
 * *away from*. Away-from rather than towards, because several of these have no single
 * destination: a restore puts a video back to whatever it was before the takedown, and an unban
 * leaves a LOCKED account locked. Anything other than the remembered value means it landed.
 *
 * While it has not landed the row stays `pending` — the badge is dimmed and the button disabled,
 * so the same action cannot be queued twice against a state that has not moved. After
 * {@link GIVE_UP_AT} the wait is abandoned and `stalled` carries the message to show instead.
 */
export function usePropagation<T>(current: T, stalledMessage: string) {
  const router = useRouter();
  /** Boxed so that a `null`/`false` state is still distinguishable from "nothing in flight". */
  const [awaiting, setAwaiting] = useState<{ value: T } | null>(null);
  const [stalled, setStalled] = useState<string | null>(null);

  /** Still moving: the row is showing the state it had when the action went in. */
  const pending = awaiting !== null && Object.is(awaiting.value, current);

  useEffect(() => {
    if (awaiting === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (pending) {
      REFRESH_AT.forEach((ms) => timers.push(setTimeout(() => router.refresh(), ms)));
      timers.push(
        setTimeout(() => {
          setAwaiting(null);
          setStalled(stalledMessage);
        }, GIVE_UP_AT),
      );
    } else {
      // Landed. The marker is dropped on the next tick rather than inside the effect body,
      // so a later return to this same state is not read as a fresh action in flight.
      timers.push(setTimeout(() => setAwaiting(null), 0));
    }

    return () => timers.forEach(clearTimeout);
  }, [awaiting, pending, router, stalledMessage]);

  return {
    pending,
    /** The give-up message once the wait was abandoned, else null. Supersedes the submit result. */
    stalled,
    watch: () => {
      setStalled(null);
      setAwaiting({ value: current });
    },
  };
}
