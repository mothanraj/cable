import { Menu, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AppHeader({ onMenuClick }) {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <button
        type="button"
        className="menu-button"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      <div className="header-title">
        Cable Management
      </div>

      <div className="header-user">
        <span>{user?.fullName}</span>

        <button
          type="button"
          className="logout-button"
          onClick={logout}
          title="Logout"
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}