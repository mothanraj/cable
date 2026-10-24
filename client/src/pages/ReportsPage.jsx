import { useEffect, useState } from "react";
import { getBillingReport } from "../api/reports";
import {
  formatMoney,
  getCurrentBillingMonth,
  statusClass,
} from "../utils/format";

export default function ReportsPage() {
  const [billingMonth, setBillingMonth] = useState(
    getCurrentBillingMonth()
  );
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await getBillingReport(billingMonth);
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "Unable to load report."
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
  }, [billingMonth]);

  const summary = report?.summary;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Billing Report</h1>
          <p>Monthly billing and collection report.</p>
        </div>
        <label className="field" style={{ minWidth: 180 }}>
          <span>Billing month</span>
          <input
            type="month"
            className="input"
            value={billingMonth.slice(0, 7)}
            onChange={(event) =>
              setBillingMonth(`${event.target.value}-01`)
            }
          />
        </label>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="muted">Loading report...</p>}

      {!loading && !error && summary && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Customers</span>
              <strong>{summary.totalCustomers}</strong>
            </div>
            <div className="stat-card">
              <span>Billed</span>
              <strong>{formatMoney(summary.totalBilled)}</strong>
            </div>
            <div className="stat-card">
              <span>Collected</span>
              <strong>{formatMoney(summary.totalCollected)}</strong>
            </div>
            <div className="stat-card">
              <span>Outstanding</span>
              <strong>{formatMoney(summary.totalOutstanding)}</strong>
            </div>
            <div className="stat-card">
              <span>Paid / Partial / Unpaid</span>
              <strong>
                {summary.paidCount}/{summary.partialCount}/
                {summary.unpaidCount}
              </strong>
            </div>
          </div>

          <div className="panel">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>STB</th>
                    <th>Phone</th>
                    <th>Place</th>
                    <th>Assigned</th>
                    <th>Package</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.records || []).length === 0 && (
                    <tr>
                      <td colSpan={10} className="empty-state">
                        No records for this month.
                      </td>
                    </tr>
                  )}
                  {(report.records || []).map((row) => (
                    <tr key={row.billing_id}>
                      <td>{row.customer_name}</td>
                      <td>{row.stb_number}</td>
                      <td>{row.phone || "-"}</td>
                      <td>{row.place || "-"}</td>
                      <td>
                        {row.assigned_user_name ||
                          row.assigned_username}
                      </td>
                      <td>{row.package_name}</td>
                      <td>{formatMoney(row.monthly_amount)}</td>
                      <td>{formatMoney(row.total_paid)}</td>
                      <td>{formatMoney(row.balance_amount)}</td>
                      <td>
                        <span className={statusClass(row.payment_status)}>
                          {row.payment_status}
                        </span>
                      </td>
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
