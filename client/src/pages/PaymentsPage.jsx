import { useEffect, useState } from "react";
import { getPayments } from "../api/payments";
import {
  formatMoney,
  normalizeDate,
} from "../utils/format";

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const rows = await getPayments();
        if (!cancelled) setPayments(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "Unable to load payments."
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

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Payment ledger for accessible customers.</p>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="muted">Loading payments...</p>}

      {!loading && !error && (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>STB</th>
                  <th>Billing month</th>
                  <th>Amount</th>
                  <th>Collected by</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      No payments found.
                    </td>
                  </tr>
                )}
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{normalizeDate(payment.payment_date)}</td>
                    <td>{payment.customer_name}</td>
                    <td>{payment.stb_number}</td>
                    <td>{normalizeDate(payment.billing_month)}</td>
                    <td>{formatMoney(payment.collected_amount)}</td>
                    <td>
                      {payment.created_by_name ||
                        payment.created_by_username}
                    </td>
                    <td>{payment.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
