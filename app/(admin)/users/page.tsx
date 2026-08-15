import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function UsersPage() {
  return (
    <NotBuiltYet
      title="Users"
      purpose="Search accounts, inspect profiles, ban or restore access."
      missing={[
        "user-service: admin list/search endpoint (GET /api/v1/admin/users with pagination + filters)",
        "auth-service: expose and allow editing the `role` column on the users table",
        "user-service: a Kafka consumer for admin.moderation-events — BAN_USER / UNBAN_USER / WARN_USER are published today but nothing subscribes, so a ban has no effect",
        "A ban state column + login check in auth-service",
      ]}
    />
  );
}
