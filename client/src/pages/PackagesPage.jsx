import { useEffect, useState } from "react";
import {
  Package as PackageIcon,
  Pencil,
  Plus,
  Power,
  Star,
} from "lucide-react";
import {
  activatePackage,
  createPackage,
  deactivatePackage,
  getPackages,
  setDefaultPackage,
  updatePackage,
} from "../api/packages";
import { formatMoney, normalizeDate } from "../utils/format";

const emptyForm = {
  packageName: "",
  monthlyAmount: "",
};

const emptyEditForm = {
  packageName: "",
  monthlyAmount: "",
};

export default function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyEditForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPackages() {
    try {
      setLoading(true);
      setError("");
      const rows = await getPackages({ includeInactive: true });
      setPackages(rows);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load packages."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await getPackages({ includeInactive: true });
        if (!cancelled) {
          setPackages(rows);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "Unable to load packages."
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
      await createPackage({
        packageName: form.packageName.trim(),
        monthlyAmount: Number(form.monthlyAmount),
      });
      setForm(emptyForm);
      setSuccess("Package created successfully.");
      await loadPackages();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to create package."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(packageRow) {
    setEditingId(packageRow.id);
    setEditingForm({
      packageName: packageRow.package_name,
      monthlyAmount: packageRow.monthly_amount,
    });
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingForm(emptyEditForm);
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updatePackage(editingId, {
        packageName: editingForm.packageName.trim(),
        monthlyAmount: Number(editingForm.monthlyAmount),
      });
      setEditingId(null);
      setEditingForm(emptyEditForm);
      setSuccess("Package updated.");
      await loadPackages();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to update package."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(packageRow) {
    setError("");
    setSuccess("");
    try {
      await setDefaultPackage(packageRow.id);
      setSuccess(
        `${packageRow.package_name} is now the default package.`
      );
      await loadPackages();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to set default package."
      );
    }
  }

  async function toggleActive(packageRow) {
    setError("");
    setSuccess("");
    try {
      if (packageRow.is_active) {
        await deactivatePackage(packageRow.id);
        setSuccess(`${packageRow.package_name} deactivated.`);
      } else {
        await activatePackage(packageRow.id);
        setSuccess(`${packageRow.package_name} activated.`);
      }
      await loadPackages();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to update package."
      );
    }
  }

  const defaultPackage = packages.find(
    (packageRow) => packageRow.is_default
  );

  return (
    <section className="page page--packages">
      <div className="page-header">
        <div>
          <h1>Packages</h1>
          <p>Create and manage the packages offered to customers.</p>
        </div>
      </div>

      {success && <p className="success-toast">{success}</p>}
      {error && <p className="error-message">{error}</p>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-body">
          <p className="admin-panel-note">
            <PackageIcon size={18} aria-hidden="true" />
            <span>
              <strong>
                Default package for user-created customers:
              </strong>{" "}
              {defaultPackage ? (
                `${defaultPackage.package_name} (${formatMoney(
                  defaultPackage.monthly_amount
                )})`
              ) : (
                <span className="muted">
                  Not set — users cannot create customers until an
                  administrator selects one.
                </span>
              )}
            </span>
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>Create package</h2>
        </div>
        <form
          className="panel-body"
          onSubmit={handleCreate}
        >
          <div className="form-grid two">
            <label className="field">
              <span>Package name</span>
              <input
                className="input"
                value={form.packageName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    packageName: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="field">
              <span>Monthly amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.monthlyAmount}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    monthlyAmount: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            <Plus size={16} aria-hidden="true" />
            {saving ? "Creating..." : "Create package"}
          </button>
        </form>
      </div>

      <div className="panel">
        {loading ? (
          <p className="muted" style={{ padding: 16 }}>
            Loading packages...
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Package</th>
                  <th className="col-num">Monthly amount</th>
                  <th>Status</th>
                  <th>Default</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No packages yet.
                    </td>
                  </tr>
                )}
                {packages.map((packageRow) =>
                  editingId === packageRow.id ? (
                    <tr key={packageRow.id}>
                      <td colSpan={6}>
                        <form
                          className="inline-edit-form"
                          onSubmit={handleUpdate}
                        >
                          <label className="field">
                            <span>Package name</span>
                            <input
                              className="input"
                              value={editingForm.packageName}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  packageName:
                                    event.target.value,
                                }))
                              }
                              required
                              autoFocus
                            />
                          </label>
                          <label className="field">
                            <span>Monthly amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input"
                              value={editingForm.monthlyAmount}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  monthlyAmount:
                                    event.target.value,
                                }))
                              }
                              required
                            />
                          </label>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={packageRow.id}>
                      <td>{packageRow.package_name}</td>
                      <td className="col-num">{formatMoney(packageRow.monthly_amount)}</td>
                      <td>
                        <span
                          className={
                            packageRow.is_active
                              ? "status-pill status-paid"
                              : "status-pill status-unpaid"
                          }
                        >
                          {packageRow.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                      <td>
                        {packageRow.is_default ? (
                          <span className="default-chip">
                            <Star
                              size={11}
                              aria-hidden="true"
                            />
                            Default
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{normalizeDate(packageRow.created_at)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(packageRow)}
                          >
                            <Pencil
                              size={14}
                              aria-hidden="true"
                            />
                            Edit
                          </button>
                          {packageRow.is_active &&
                            !packageRow.is_default && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  handleSetDefault(packageRow)
                                }
                              >
                                <Star
                                  size={14}
                                  aria-hidden="true"
                                />
                                Set default
                              </button>
                            )}
                          {packageRow.is_active &&
                          packageRow.is_default ? (
                            <span className="muted">
                              Set another default to deactivate
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={
                                packageRow.is_active
                                  ? "btn btn-danger btn-sm"
                                  : "btn btn-secondary btn-sm"
                              }
                              onClick={() =>
                                toggleActive(packageRow)
                              }
                            >
                              <Power
                                size={14}
                                aria-hidden="true"
                              />
                              {packageRow.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
