import {
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/names";

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const groups = [
    {
      label: "Overview",
      links: [
        {
          to: isAdmin ? "/admin" : "/dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          tone: "indigo",
          end: true,
        },
      ],
    },
    {
      label: "Operations",
      links: [
        {
          to: "/customers",
          label: "Customers",
          icon: Users,
          tone: "cyan",
        },
        {
          to: "/payments",
          label: "Payments",
          icon: CreditCard,
          tone: "emerald",
        },
        {
          to: "/reports",
          label: "Reports",
          icon: FileText,
          tone: "amber",
        },
      ],
    },
  ];

  if (isAdmin) {
    groups.push({
      label: "Administration",
      links: [
        {
          to: "/users",
          label: "Users",
          icon: ShieldCheck,
          tone: "pink",
        },
        {
          to: "/places",
          label: "Places",
          icon: MapPin,
          tone: "violet",
        },
        {
          to: "/packages",
          label: "Packages",
          icon: Package,
          tone: "blue",
        },
      ],
    });
  }

  return (
    <>
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <BrandMark />
          <span className="sidebar-brand-copy">
            <span className="sidebar-brand-name">Cable</span>
            <span className="sidebar-brand-sub">
              Management
            </span>
          </span>
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
          {groups.map((group) => (
            <div key={group.label}>
              <p className="nav-section">{group.label}</p>

              {group.links.map((link) => {
                const Icon = link.icon;

                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `nav-link tone-${link.tone} ${
                        isActive ? "active" : ""
                      }`
                    }
                  >
                    <span
                      className="nav-icon"
                      aria-hidden="true"
                    >
                      <Icon
                        size={18}
                        strokeWidth={2}
                      />
                    </span>
                    <span className="nav-link-label">
                      {link.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span className="avatar avatar--sm">
              {getInitials(user?.fullName || user?.username)}
            </span>
            <span className="sidebar-user-copy">
              <strong>{user?.fullName || user?.username}</strong>
              <span>
                {isAdmin ? "Administrator" : "Collector"}
              </span>
            </span>
          </div>
        </div>
      </aside>

      <div
        className={`sidebar-overlay ${open ? "show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}
