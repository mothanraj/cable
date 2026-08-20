import { useAuth } from "../context/AuthContext";

export default function AdminHome() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user.fullName}</p>

      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
}