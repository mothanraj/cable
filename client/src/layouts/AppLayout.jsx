import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";

const PAGE_TITLES = {
  "/admin": "Admin dashboard",
  "/dashboard": "Collector dashboard",
  "/customers": "Customers",
  "/payments": "Payments",
  "/reports": "Reports",
  "/users": "Users",
  "/places": "Places",
  "/packages": "Packages",
};

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "Cable Management";

  return (
    <div className="app-shell">
      <div className="aurora-bg" aria-hidden="true">
        <span className="aurora-blob aurora-blob--a" />
        <span className="aurora-blob aurora-blob--b" />
        <span className="aurora-blob aurora-blob--c" />
      </div>

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <AppHeader
        title={pageTitle}
        onMenuClick={() => setMenuOpen(true)}
      />

      <main className="app-content">
        <div
          className="page-transition"
          key={location.pathname}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
