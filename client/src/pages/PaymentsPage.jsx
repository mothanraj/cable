import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { getPayments } from "../api/payments";
import {
  formatMoney,
  normalizeDate,
} from "../utils/format";

const SUMMARY_CHIPS = [
  {
    key: "total",
    label: "Total collected",
    icon: Banknote,
    tone: "emerald",
    format: (value) => formatMoney(value),
  },
  {
    key: "count",
    label: "Payments recorded",
    icon: Receipt,
    tone: "indigo",
    format: (value) => Math.round(value),
  },
  {
    key: "average",
    label: "Average payment",
    icon: TrendingUp,
    tone: "cyan",
    format: (value) => formatMoney(value),
  },
];

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

  const totals = useMemo(() => {
    const total = payments.reduce(
      (sum, payment) =>
        sum + Number(payment.collected_amount || 0),
      0
    );

    return {
      total,
      count: payments.length,
      average: payments.length
        ? total / payments.length
        : 0,
    };
  }, [payments]);

  return (
    <section className="page page--payments">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Payment ledger for accessible customers.</p>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <div className="loading-block">Loading payments...</div>}

      {!loading && !error && (
        <>
          <div className="summary-chips">
            {SUMMARY_CHIPS.map((chip, index) => {
              const Icon = chip.icon;

              return (
                <div
                  className={`summary-chip summary-chip--${chip.tone}`}
                  key={chip.key}
                  style={{ "--delay": `${index * 70}ms` }}
                >
                  <span
                    className="summary-chip-icon"
                    aria-hidden="true"
                  >
                    <Icon size={19} strokeWidth={2} />
                  </span>
                  <span className="summary-chip-copy">
                    <span>{chip.label}</span>
                    <strong>
                      {chip.format(totals[chip.key])}
                    </strong>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Payment ledger</h2>
              <span className="muted">
                {payments.length} entries
              </span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>STB</th>
                    <th>Billing month</th>
                    <th className="col-num">Amount</th>
                    <th>Collected by</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        No payments found.
                      </td>
                    </tr>
                  )}
                  {payments.map((payment, index) => (
                    <tr key={payment.id}>
                      <td className="serial-cell">
                        {index + 1}
                      </td>
                      <td>
                        {normalizeDate(payment.payment_date)}
                      </td>
                      <td>{payment.customer_name}</td>
                      <td>{payment.stb_number}</td>
                      <td>
                        {normalizeDate(payment.billing_month)}
                      </td>
                      <td className="col-num amount-strong">
                        {formatMoney(payment.collected_amount)}
                      </td>
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
        </>
      )}
    </section>
  );
}
