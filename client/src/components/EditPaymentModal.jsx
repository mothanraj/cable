import { useState } from "react";
import { updatePaymentAmount } from "../api/payments";
import { formatMoney, normalizeDate } from "../utils/format";
import Modal from "./Modal";

export default function EditPaymentModal({
  open,
  payment,
  onClose,
  onSuccess,
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !payment) return null;

  const currentAmount = Number(payment.collected_amount || 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updatePaymentAmount(payment.id, {
        collectedAmount: Number(amount),
        reason: reason.trim() || null,
      });

      onSuccess?.();
      onClose();
      setAmount("");
      setReason("");
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to correct the payment amount."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Correct collected amount"
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
            form="correction-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save correction"}
          </button>
        </>
      }
    >
      <form
        id="correction-form"
        className="form-grid"
        onSubmit={handleSubmit}
      >
        <div className="summary-box">
          <div>
            <span>Customer</span>
            <strong>{payment.customer_name}</strong>
          </div>
          <div>
            <span>Payment date</span>
            <strong>{normalizeDate(payment.payment_date)}</strong>
          </div>
          <div>
            <span>Billing month</span>
            <strong>{normalizeDate(payment.billing_month)}</strong>
          </div>
          <div>
            <span>Entered amount</span>
            <strong>{formatMoney(currentAmount)}</strong>
          </div>
          <div>
            <span>Entered by</span>
            <strong>
              {payment.created_by_name ||
                payment.created_by_username ||
                "-"}
            </strong>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>Corrected amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="input"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={String(currentAmount)}
            required
          />
        </label>

        <label className="field">
          <span>Reason for correction</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional - e.g. wrong figure entered by collector"
          />
        </label>
      </form>
    </Modal>
  );
}
