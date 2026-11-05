import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import AdminLayout from "../layouts/AdminLayout";
import AdminHome from "../pages/AdminHome";
import AdminLogin from "../pages/AdminLogin";
import CustomersPage from "../pages/customers/CustomersPage";
import Login from "../pages/Login";
import PackagesPage from "../pages/PackagesPage";
import PaymentsPage from "../pages/PaymentsPage";
import PlacesPage from "../pages/PlacesPage";
import ReportsPage from "../pages/ReportsPage";
import UserHome from "../pages/UserHome";
import UserLogin from "../pages/UserLogin";
import UsersPage from "../pages/UsersPage";
import ProtectedRoute from "./ProtectedRoute";

function HomeRedirect() {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <div className="login-page">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/user/login"
        replace
      />
    );
  }

  return (
    <Navigate
      to={user.role === "ADMIN" ? "/admin" : "/dashboard"}
      replace
    />
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />
      <Route
        path="/admin/login"
        element={<AdminLogin />}
      />
      <Route
        path="/user/login"
        element={<UserLogin />}
      />

      <Route
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "USER"]}
            loginPath="/user/login"
          />
        }
      >
        <Route element={<AdminLayout />}>
          <Route
            path="/customers"
            element={<CustomersPage />}
          />
          <Route
            path="/payments"
            element={<PaymentsPage />}
          />

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["ADMIN"]}
                loginPath="/admin/login"
              />
            }
          >
            <Route
              path="/admin"
              element={<AdminHome />}
            />
            <Route
              path="/users"
              element={<UsersPage />}
            />
            <Route
              path="/places"
              element={<PlacesPage />}
            />
            <Route
              path="/reports"
              element={<ReportsPage />}
            />
            <Route
              path="/packages"
              element={<PackagesPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["USER"]}
                loginPath="/user/login"
              />
            }
          >
            <Route
              path="/dashboard"
              element={<UserHome />}
            />
          </Route>
        </Route>
      </Route>

      <Route
        path="/"
        element={<HomeRedirect />}
      />
      <Route
        path="*"
        element={<HomeRedirect />}
      />
    </Routes>
  );
}
