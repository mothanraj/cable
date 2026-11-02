import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import BrandMark from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";

/**
 * Shared login form for a specific role.
 * expectedRole: "ADMIN" | "USER"
 */
export default function RoleLoginPage({
  expectedRole,
  title,
  subtitle,
  alternateLink,
}) {
  const {
    login,
    logout,
    loading,
    isAuthenticated,
    user,
  } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdminPortal = expectedRole === "ADMIN";
  const homePath = isAdminPortal ? "/admin" : "/dashboard";

  if (loading) {
    return (
      <div className="login-page">
        <p className="login-loading">Loading session...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user.role === expectedRole) {
      return (
        <Navigate
          to={homePath}
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

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const data = await login(
        username.trim(),
        password
      );

      if (data.user.role !== expectedRole) {
        await logout();
        setError(
          expectedRole === "ADMIN"
            ? "This portal is for administrators only. Use the collector login."
            : "This portal is for collectors only. Use the admin login."
        );
        return;
      }

      navigate(homePath);
    } catch (submitError) {
      const apiMessage =
        submitError.response?.data?.error?.message;
      setError(
        apiMessage ||
          (submitError.request && !submitError.response
            ? "Cannot reach the API. Check that the server is running and that this origin is allowed by CORS."
            : "Login failed.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <div className="auth-visual-top">
          <BrandMark />
          <span className="auth-visual-brand">
            <strong>Cable</strong>
            <span>Management</span>
          </span>
        </div>

      </aside>

      <main className="auth-main">
        <section className="auth-card">
          <header className="auth-card-head">
            <span
              className="auth-card-icon"
              aria-hidden="true"
            >
              {isAdminPortal ? (
                <ShieldCheck size={23} strokeWidth={2} />
              ) : (
                <Users size={23} strokeWidth={2} />
              )}
            </span>

            <div>
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
          </header>

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >
            <label className="field">
              <span>Username</span>
              <input
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                autoComplete="username"
                required
                placeholder="Enter username"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  required
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p
                className="form-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>

            <p className="auth-note">
              <LockKeyhole size={13} aria-hidden="true" />
              Secure session with automatic sign-out
            </p>
          </form>

          {alternateLink && (
            <p className="auth-alternate">
              <Link to={alternateLink.to}>
                {alternateLink.label}
              </Link>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
