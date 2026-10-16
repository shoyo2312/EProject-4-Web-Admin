import { NOTIFICATIONS_SEEN_COOKIE } from "@/lib/api/config";

/**
 * Records that the admin has seen the feed up to `at`, the newest item's timestamp. A cookie
 * rather than browser storage because the layout reads it on the server to draw the bell's count.
 * One year, path=/ so every route agrees.
 */
export function rememberNotificationsSeen(at: number) {
  document.cookie = `${NOTIFICATIONS_SEEN_COOKIE}=${at}; path=/; max-age=31536000; samesite=lax`;
}
