import { cookies } from "next/headers";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { getNotificationCenter } from "@/lib/api/notifications";
import { referenceNow } from "@/lib/api/shared";
import { NOTIFICATIONS_SEEN_COOKIE } from "@/lib/api/config";
import type { AdminNotification } from "@/lib/notifications";

/**
 * Everything the bell would mention, not cut to its twenty: open reports, held videos, trashed
 * videos close to being erased, and the last day's sign-ups and uploads.
 */
export default async function NotificationsPage() {
  const jar = await cookies();
  const seenAt = Number(jar.get(NOTIFICATIONS_SEEN_COOKIE)?.value) || 0;

  let items: AdminNotification[];
  try {
    items = await getNotificationCenter();
  } catch (error) {
    return (
      <>
        <PageHeader title="Notifications" />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Open reports, held videos, trash about to be erased, and the last day's sign-ups and uploads."
      />
      <NotificationCenter items={items} seenAt={seenAt} now={referenceNow()} />
    </>
  );
}
