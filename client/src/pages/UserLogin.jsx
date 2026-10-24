import RoleLoginPage from "./RoleLoginPage";

export default function UserLogin() {
  return (
    <RoleLoginPage
      expectedRole="USER"
      title="Collector Login"
      subtitle="Sign in to view assigned customers and collect payments."
    />
  );
}
