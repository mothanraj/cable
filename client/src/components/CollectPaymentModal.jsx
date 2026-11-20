import { useState } from "react";
import {
  createPayment,
  payArrears,
} from "../api/payments";
import {
  formatMoney,
  getToday,
  normalizeDate,
} from "../utils/format";
import Modal from "./Modal";

export default function CollectPaymentModal({
  open,
  bill,
  customer,
  mode = "bill",
  onClose,
  onSuccess,
}) {
  const isArrears = mode === "arrears";
  const arrearsAmount = Number(customer?.overdue_amount || 0);

  const [collectedAmount, setCollectedAmount] = useState(
    isArrears && arrearsAmount > 0
      ? String(arrearsAmount)
      : ""
  );
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !customer || (!isArrears && !bill)) {
    return null;
  }

  const remainingAfter = isArrears
    ? Math.max(
        arrearsAmount - Number(collectedAmount || 0),
        0
      )
    : 0;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (isArrears) {
        await payArrears({
          customerId: customer.id,
          amount: Number(collectedAmount),
          paymentDate,
          remarks: remarks.trim() || null,
        });
      } else {
        await createPayment({
          billingId: bill.billing_id || bill.id,
          paymentDate,
          collectedAmount: Number(collectedAmount),
          remarks: remarks.trim() || null,
        });
      }

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
      title={
        isArrears
          ? `Pay arrears for ${customer.customer_name}`
          : `Collect payment for ${customer.customer_name}`
      }
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
        {isArrears ? (
          <div className="summary-box">
            <div>
              <span>Total arrears</span>
              <strong>{formatMoney(arrearsAmount)}</strong>
            </div>
            <div>
              <span>Oldest pending</span>
              <strong>
                {normalizeDate(customer.overdue_month)}
              </strong>
            </div>
            <div>
              <span>Remaining after payment</span>
              <strong>{formatMoney(remainingAfter)}</strong>
            </div>
          </div>
        ) : (
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
        )}

        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>
            {isArrears ? "Arrears amount collected" : "Amount collected"}
          </span>
          <input
            type="number"
            min="0.01"
            max={isArrears ? arrearsAmount : undefined}
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
