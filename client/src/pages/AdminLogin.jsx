import RoleLoginPage from "./RoleLoginPage";

export default function AdminLogin() {
  return (
    <RoleLoginPage
      expectedRole="ADMIN"
      title="Admin Login"
      subtitle="Sign in to manage users, customers, billing, and reports."
      alternateLink={{
        to: "/user/login",
        label: "Collector login →",
      }}
    />
  );
}
