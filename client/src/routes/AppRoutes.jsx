import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";


import CustomersPage from "../pages/customers/CustomersPage";
import Login from "../pages/Login";
import AdminHome from "../pages/AdminHome";
import UserHome from "../pages/UserHome";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />
    
    <Route
  path="/customers"
  element={<CustomersPage />}
/>

<Route
  path="/customers"
  element={<CustomersPage />}
/>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN"]}
          />
        }
      >
        <Route
          path="/admin"
          element={<AdminHome />}
        />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={["USER"]}
          />
        }
      >
        <Route
          path="/dashboard"
          element={<UserHome />}
        />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />
    </Routes>
  );
}