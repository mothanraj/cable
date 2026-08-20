import { useAuth } from "../context/AuthContext";

export default function UserHome() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Collector Dashboard</h1>
      <p>Welcome, {user.fullName}</p>

      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
}