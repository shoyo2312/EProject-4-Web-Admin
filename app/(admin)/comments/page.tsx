import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function CommentsPage() {
  return (
    <NotBuiltYet
      title="Comments"
      purpose="Review reported comments and remove them on a user's behalf."
      missing={[
        "interaction-service: DELETE currently authorises the comment author only — needs an admin path",
        "interaction-service: list-by-report-target lookup so a COMMENT report can render its comment",
        "Cassandra query pattern for fetching a comment by id alone (today reads go through videoId)",
      ]}
    />
  );
}
