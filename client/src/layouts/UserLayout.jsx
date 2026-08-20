import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";

export default function UserLayout() {
  const [menuOpen, setMenuOpen] =
    useState(false);

  return (
    <div className="app-shell">
      <AppHeader
        onMenuClick={() => setMenuOpen(true)}
      />

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}