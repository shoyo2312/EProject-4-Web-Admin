import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function SettingsPage() {
  return (
    <NotBuiltYet
      title="Settings"
      purpose="Console configuration, admin accounts and audit retention."
      missing={[
        "auth-service: admin user management (create/disable admin accounts, assign ROLE_ADMIN)",
        "Configurable moderation thresholds — currently hard-coded",
        "Session controls: force logout of an admin via auth:blacklist:user:{userId}",
      ]}
    />
  );
}
