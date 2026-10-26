import {
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({
  open,
  onClose,
}) {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const links = [
    {
      to: isAdmin ? "/admin" : "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: "/customers",
      label: "Customers",
      icon: Users,
    },
    {
      to: "/payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      to: "/reports",
      label: "Reports",
      icon: FileText,
    },
  ];

  if (isAdmin) {
    links.push({
      to: "/users",
      label: "Users",
      icon: Users,
    });
    links.push({
      to: "/places",
      label: "Places",
      icon: MapPin,
    });
    links.push({
      to: "/packages",
      label: "Packages",
      icon: Package,
    });
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${
          open ? "show" : ""
        }`}
        onClick={onClose}
      />

      <aside
        className={`sidebar ${
          open ? "open" : ""
        }`}
      >
        <div className="sidebar-header">
          <strong>Cable Management</strong>

          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {links.map(
            ({
              to,
              label,
              icon: Icon,
              end,
            }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <Icon size={19} />
                <span>{label}</span>
              </NavLink>
            )
          )}
        </nav>
      </aside>
    </>
  );
}