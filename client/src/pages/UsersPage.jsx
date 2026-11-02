import { useEffect, useState } from "react";
import {
  KeyRound,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import {
  activateUser,
  createUser,
  deactivateUser,
  getUsers,
  resetUserPassword,
} from "../api/users";
import Modal from "../components/Modal";
import { normalizeDate } from "../utils/format";
import { getInitials } from "../utils/names";

const emptyForm = {
  username: "",
  fullName: "",
  password: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetForm, setResetForm] = useState({
    password: "",
    confirm: "",
  });
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      const rows = await getUsers();
      setUsers(rows);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await getUsers();
        if (!cancelled) setUsers(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "Unable to load users."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createUser({
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
      });
      setForm(emptyForm);
      setSuccess("User created successfully.");
      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to create user."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    setError("");
    setSuccess("");
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
        setSuccess(`${user.username} deactivated.`);
      } else {
        await activateUser(user.id);
        setSuccess(`${user.username} activated.`);
      }
      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to update user."
      );
    }
  }

  function openReset(user) {
    setResetTarget(user);
    setResetForm({ password: "", confirm: "" });
    setResetError("");
  }

  function closeReset() {
    if (resetting) return;

    setResetTarget(null);
    setResetForm({ password: "", confirm: "" });
    setResetError("");
  }

  async function handleReset(event) {
    event.preventDefault();
    setResetError("");

    if (resetForm.password.length < 12) {
      setResetError("Password must be at least 12 characters.");
      return;
    }

    if (resetForm.password !== resetForm.confirm) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetting(true);

    try {
      await resetUserPassword(
        resetTarget.id,
        resetForm.password
      );
      setSuccess(
        `Password reset for ${resetTarget.username}. They were signed out of all sessions.`
      );
      setResetTarget(null);
      setResetForm({ password: "", confirm: "" });
    } catch (err) {
      setResetError(
        err.response?.data?.error?.message ||
          "Unable to reset password."
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="page page--users">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Create and manage collector accounts.</p>
        </div>
      </div>

      {success && <p className="success-toast">{success}</p>}
      {error && <p className="error-message">{error}</p>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>Create user</h2>
        </div>
        <form
          className="panel-body"
          onSubmit={handleCreate}
        >
          <div className="form-grid two">
            <label className="field">
              <span>Username</span>
              <input
                className="input"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="field">
              <span>Full name</span>
              <input
                className="input"
                value={form.fullName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Password (min 12 characters)</span>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              minLength={12}
              required
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            <UserPlus size={16} aria-hidden="true" />
            {saving ? "Creating..." : "Create USER"}
          </button>
        </form>
      </div>

      <div className="panel">
        {loading ? (
          <p className="muted" style={{ padding: 16 }}>
            Loading users...
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <span
                          className={`avatar avatar--sm ${
                            user.role === "ADMIN"
                              ? "avatar--admin"
                              : "avatar--user"
                          }`}
                          aria-hidden="true"
                        >
                          {getInitials(
                            user.full_name || user.username
                          )}
                        </span>
                        <strong>{user.username}</strong>
                      </div>
                    </td>
                    <td>{user.full_name}</td>
                    <td>
                      <span
                        className={`role-chip ${
                          user.role === "ADMIN"
                            ? "role-chip--admin"
                            : ""
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          user.is_active
                            ? "status-pill status-paid"
                            : "status-pill status-unpaid"
                        }
                      >
                        {user.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                    <td>{normalizeDate(user.created_at)}</td>
                    <td>
                      {user.role === "USER" && (
                        <div className="table-actions">
                          <button
                            type="button"
                            className={
                              user.is_active
                                ? "btn btn-danger btn-sm"
                                : "btn btn-secondary btn-sm"
                            }
                            onClick={() => toggleActive(user)}
                          >
                            {user.is_active ? (
                              <UserX
                                size={14}
                                aria-hidden="true"
                              />
                            ) : (
                              <UserCheck
                                size={14}
                                aria-hidden="true"
                              />
                            )}
                            {user.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openReset(user)}
                          >
                            <KeyRound
                              size={14}
                              aria-hidden="true"
                            />
                            Reset password
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resetTarget && (
        <Modal
          title={`Reset password for ${resetTarget.username}`}
          onClose={closeReset}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeReset}
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reset-password-form"
                className="btn btn-primary"
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset password"}
              </button>
            </>
          }
        >
          <form
            id="reset-password-form"
            className="form-grid"
            onSubmit={handleReset}
          >
            {resetError && (
              <p className="form-error">{resetError}</p>
            )}

            <p className="muted">
              Set a new password for {resetTarget.full_name} (
              {resetTarget.username}). Their active sessions will
              be signed out.
            </p>

            <label className="field">
              <span>New password (min 12 characters)</span>
              <input
                type="password"
                className="input"
                value={resetForm.password}
                onChange={(event) =>
                  setResetForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                className="input"
                value={resetForm.confirm}
                onChange={(event) =>
                  setResetForm((prev) => ({
                    ...prev,
                    confirm: event.target.value,
                  }))
                }
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
          </form>
        </Modal>
      )}
    </section>
  );
}
