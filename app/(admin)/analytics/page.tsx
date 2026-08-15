import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function AnalyticsPage() {
  return (
    <NotBuiltYet
      title="Analytics"
      purpose="Engagement, signup and revenue trends across the whole platform."
      missing={[
        "analytics-service has no SecurityConfig — /api/v1/analytics/** is currently unauthenticated and must be guarded with security-lib (ROLE_ADMIN) first",
        "GET /api/v1/analytics/engagement/daily only returns raw daily counts; per-video and per-creator breakdowns need new endpoints",
        "No retention/cohort aggregation exists in ClickHouse yet",
      ]}
    />
  );
}
