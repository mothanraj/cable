import { useEffect, useState } from "react";
import { getPackages } from "../api/packages";
import { getUsers } from "../api/users";
import { useAuth } from "../context/AuthContext";
import Modal from "./Modal";

const emptyForm = {
  customerName: "",
  stbNumber: "",
  phone: "",
  place: "",
  packageId: "",
  customMonthlyAmount: "",
  assignedUserId: "",
  remarks: "",
};

export default function CustomerFormModal({
  open,
  mode,
  initialCustomer,
  onClose,
  onSubmit,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [form, setForm] = useState(emptyForm);
  const [packages, setPackages] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setError("");
    setForm(
      initialCustomer
        ? {
            customerName: initialCustomer.customer_name || "",
            stbNumber: initialCustomer.stb_number || "",
            phone: initialCustomer.phone || "",
            place: initialCustomer.place || "",
            packageId: initialCustomer.package_id || "",
            customMonthlyAmount:
              initialCustomer.custom_monthly_amount ?? "",
            assignedUserId:
              initialCustomer.assigned_user_id || "",
            remarks: initialCustomer.remarks || "",
          }
        : emptyForm
    );

    async function loadRefs() {
      try {
        const packageRows = await getPackages();
        setPackages(packageRows);

        if (isAdmin) {
          const userRows = await getUsers();
          setUsers(
            userRows.filter(
              (row) => row.role === "USER" && row.is_active
            )
          );
        }
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            "Unable to load form data."
        );
      }
    }

    loadRefs();
  }, [open, initialCustomer, isAdmin]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        customerName: form.customerName.trim(),
        stbNumber: form.stbNumber.trim(),
        phone: form.phone.trim() || null,
        place: form.place.trim() || null,
        packageId: form.packageId,
        customMonthlyAmount:
          form.customMonthlyAmount === ""
            ? null
            : Number(form.customMonthlyAmount),
        remarks: form.remarks.trim() || null,
      };

      if (mode === "create" && isAdmin) {
        payload.assignedUserId = form.assignedUserId;
      }

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to save customer."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={mode === "create" ? "Add customer" : "Edit customer"}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="customer-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <form
        id="customer-form"
        className="form-grid"
        onSubmit={handleSubmit}
      >
        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>Customer name</span>
          <input
            className="input"
            value={form.customerName}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                customerName: event.target.value,
              }))
            }
            required
          />
        </label>

        <div className="form-grid two">
          <label className="field">
            <span>STB number</span>
            <input
              className="input"
              value={form.stbNumber}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  stbNumber: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              className="input"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <label className="field">
          <span>Place</span>
          <input
            className="input"
            value={form.place}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                place: event.target.value,
              }))
            }
          />
        </label>

        <label className="field">
          <span>Package</span>
          <select
            className="select"
            value={form.packageId}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                packageId: event.target.value,
              }))
            }
            required
          >
            <option value="">Select package</option>
            {packages.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.package_name} (₹{item.monthly_amount})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Custom monthly amount (optional)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.customMonthlyAmount}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                customMonthlyAmount: event.target.value,
              }))
            }
          />
        </label>

        {mode === "create" && isAdmin && (
          <label className="field">
            <span>Assigned user</span>
            <select
              className="select"
              value={form.assignedUserId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  assignedUserId: event.target.value,
                }))
              }
              required
            >
              <option value="">Select collector</option>
              {users.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.full_name} ({item.username})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Remarks</span>
          <textarea
            className="textarea"
            rows={3}
            value={form.remarks}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                remarks: event.target.value,
              }))
            }
          />
        </label>
      </form>
    </Modal>
  );
}
