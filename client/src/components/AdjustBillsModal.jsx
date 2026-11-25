import { useState } from "react";
import { adjustBills } from "../api/billing";
import { formatMoney } from "../utils/format";
import Modal from "./Modal";

export default function AdjustBillsModal({
  open,
  rows = [],
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.billingId,
        {
          newDue: String(row.currentDue ?? 0),
          newOverpaid: String(row.currentOverpaid ?? 0),
        },
      ])
    )
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || rows.length === 0) return null;

  function updateValue(billingId, field, value) {
    setValues((current) => ({
      ...current,
      [billingId]: {
        ...current[billingId],
        [field]: value,
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const entries = rows.map((row) => ({
        billingId: row.billingId,
        newDue: Number(values[row.billingId]?.newDue ?? 0),
        newOverpaid: Number(
          values[row.billingId]?.newOverpaid ?? 0
        ),
      }));

      if (
        entries.some(
          (entry) => entry.newDue < 0 || entry.newOverpaid < 0
        )
      ) {
        throw new Error("Values cannot be negative.");
      }

      const result = await adjustBills({
        entries,
        reason: reason.trim() || null,
      });

      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Unable to adjust the selected bills."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit due / overpaid"
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
            form="adjust-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save adjustments"}
          </button>
        </>
      }
    >
      <form
        id="adjust-form"
        className="form-grid"
        onSubmit={handleSubmit}
      >
        <p className="muted">
          Set the exact Due and Overpaid (credit) you want for
          each selected customer. Changes are audited with your
          name and the reason below.
        </p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="col-num">Current due</th>
                <th className="col-num">New due</th>
                <th className="col-num">Current overpaid</th>
                <th className="col-num">New overpaid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.billingId}>
                  <td>
                    {row.customerName}
                    <br />
                    <span className="muted">STB: {row.stbNumber}</span>
                  </td>
                  <td className="col-num">
                    {formatMoney(row.currentDue)}
                  </td>
                  <td className="col-num">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={
                        values[row.billingId]?.newDue ?? ""
                      }
                      onChange={(event) =>
                        updateValue(
                          row.billingId,
                          "newDue",
                          event.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td className="col-num">
                    {formatMoney(row.currentOverpaid)}
                  </td>
                  <td className="col-num">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={
                        values[row.billingId]?.newOverpaid ?? ""
                      }
                      onChange={(event) =>
                        updateValue(
                          row.billingId,
                          "newOverpaid",
                          event.target.value
                        )
                      }
                      required
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>Reason for adjustment</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional - e.g. wrong due entered, credit given by owner"
          />
        </label>
      </form>
    </Modal>
  );
}
