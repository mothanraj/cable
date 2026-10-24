import { useState } from "react";
import { createPayment } from "../api/payments";
import {
  formatMoney,
  getToday,
} from "../utils/format";
import Modal from "./Modal";

export default function CollectPaymentModal({
  open,
  bill,
  customer,
  onClose,
  onSuccess,
}) {
  const [collectedAmount, setCollectedAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !bill || !customer) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await createPayment({
        billingId: bill.billing_id || bill.id,
        paymentDate,
        collectedAmount: Number(collectedAmount),
        remarks: remarks.trim() || null,
      });
      onSuccess?.();
      onClose();
      setCollectedAmount("");
      setRemarks("");
      setPaymentDate(getToday());
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Collect payment — ${customer.customer_name}`}
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
            form="payment-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : "Record payment"}
          </button>
        </>
      }
    >
      <form
        id="payment-form"
        className="form-grid"
        onSubmit={handleSubmit}
      >
        <div className="summary-box">
          <div>
            <span>Monthly bill</span>
            <strong>{formatMoney(bill.monthly_amount)}</strong>
          </div>
          <div>
            <span>Already paid</span>
            <strong>{formatMoney(bill.total_paid)}</strong>
          </div>
          <div>
            <span>Current balance</span>
            <strong>{formatMoney(bill.balance_amount)}</strong>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>Amount collected</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="input"
            value={collectedAmount}
            onChange={(event) =>
              setCollectedAmount(event.target.value)
            }
            required
          />
        </label>

        <label className="field">
          <span>Payment date</span>
          <input
            type="date"
            className="input"
            value={paymentDate}
            onChange={(event) =>
              setPaymentDate(event.target.value)
            }
            required
          />
        </label>

        <label className="field">
          <span>Remarks</span>
          <textarea
            className="textarea"
            rows={3}
            value={remarks}
            onChange={(event) =>
              setRemarks(event.target.value)
            }
          />
        </label>
      </form>
    </Modal>
  );
}
