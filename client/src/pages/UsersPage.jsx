import { useEffect, useState } from "react";
import {
  activateUser,
  createUser,
  deactivateUser,
  getUsers,
} from "../api/users";
import { normalizeDate } from "../utils/format";

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
    loadUsers();
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

  return (
    <section>
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
                    <td>{user.username}</td>
                    <td>{user.full_name}</td>
                    <td>{user.role}</td>
                    <td>{user.is_active ? "Active" : "Inactive"}</td>
                    <td>{normalizeDate(user.created_at)}</td>
                    <td>
                      {user.role === "USER" && (
                        <button
                          type="button"
                          className={
                            user.is_active
                              ? "btn btn-danger btn-sm"
                              : "btn btn-secondary btn-sm"
                          }
                          onClick={() => toggleActive(user)}
                        >
                          {user.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
