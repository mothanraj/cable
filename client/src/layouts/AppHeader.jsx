import { CalendarDays, LogOut, Menu } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/names";

function formatToday() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());
}

export default function AppHeader({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="app-header">
      <button
        type="button"
        className="menu-button"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={21} />
      </button>

      <span className="header-brand-mobile">
        <BrandMark size="sm" />
        <strong>Cable</strong>
      </span>

      <span className="header-title">
        {title || "Cable Management"}
      </span>

      <span className="header-date">
        <CalendarDays size={14} aria-hidden="true" />
        {formatToday()}
      </span>

      <div className="header-user">
        <span className="header-avatar">
          {getInitials(user?.fullName || user?.username)}
        </span>

        <span className="header-user-meta">
          <strong>{user?.fullName || user?.username}</strong>
          <span>
            {isAdmin ? "Administrator" : "Collector"}
          </span>
        </span>

        <button
          type="button"
          className="logout-button"
          onClick={logout}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
