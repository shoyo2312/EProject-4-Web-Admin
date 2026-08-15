import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function VideosPage() {
  return (
    <NotBuiltYet
      title="Videos"
      purpose="Browse uploads, review flagged content, take down or restore."
      missing={[
        "video-service: platform-wide list endpoint — GET /api/v1/videos/users/{userId} is per-creator only",
        "Filters by moderation state and upload date",
        "Takedown/restore itself already works: admin.moderation-events → AdminModerationEventConsumer",
      ]}
    />
  );
}
