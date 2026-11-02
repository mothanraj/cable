import { useEffect, useMemo, useState } from "react";
import { getDashboard } from "../api/dashboard";
import {
  formatMoney,
  getCurrentBillingMonth,
  getOverpaidAmount,
  normalizeDate,
  statusClass,
} from "../utils/format";

export default function DashboardPage({ title }) {
  const [billingMonth, setBillingMonth] = useState(
    getCurrentBillingMonth()
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const dashboard = await getDashboard(billingMonth);
        if (!cancelled) {
          setData(dashboard);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "Unable to load dashboard."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [billingMonth]);

  const summary = data?.summary;

  const statusTotals = useMemo(() => {
    const totals = {
      PAID: 0,
      PARTIAL: 0,
      UNPAID: 0,
      OVERPAID: 0,
    };

    for (const row of data?.billing || []) {
      if (row.payment_status === "PAID") {
        totals.PAID += Number(row.total_paid || 0);
      } else if (
        row.payment_status === "PARTIAL" ||
        row.payment_status === "UNPAID"
      ) {
        totals[row.payment_status] += Number(
          row.balance_amount || 0
        );
      } else if (row.payment_status === "OVERPAID") {
        totals.OVERPAID += getOverpaidAmount(row);
      }
    }

    return totals;
  }, [data]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Collection overview for the selected billing month.</p>
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
      {loading && <p className="muted">Loading dashboard...</p>}

      {!loading && !error && summary && (
        <>
          <div className="dashboard-stats">
            <div className="stats-grid stats-grid--dashboard">
              <div className="stat-card">
                <span>Paid</span>
                <strong>{summary.paidCount}</strong>
                <small className="stat-card-value">
                  {formatMoney(statusTotals.PAID)} collected
                </small>
              </div>
              <div className="stat-card">
                <span>Overpaid</span>
                <strong>{summary.overpaidCount ?? 0}</strong>
                <small className="stat-card-value">
                  {formatMoney(statusTotals.OVERPAID)} excess
                </small>
              </div>
              <div className="stat-card">
                <span>Unpaid</span>
                <strong>{summary.unpaidCount}</strong>
                <small className="stat-card-value">
                  {formatMoney(statusTotals.UNPAID)} due
                </small>
              </div>
              <div className="stat-card">
                <span>Partial</span>
                <strong>{summary.partialCount}</strong>
                <small className="stat-card-value">
                  {formatMoney(statusTotals.PARTIAL)} due
                </small>
              </div>
            </div>
            <div className="stats-grid stats-grid--dashboard">
              <div className="stat-card">
                <span>Total customers</span>
                <strong>{summary.totalCustomers}</strong>
              </div>
              <div className="stat-card">
                <span>Collected (month)</span>
                <strong>{formatMoney(summary.totalCollected)}</strong>
              </div>
              <div className="stat-card">
                <span>Pending (month)</span>
                <strong>{formatMoney(summary.totalOutstanding)}</strong>
              </div>
              <div className="stat-card">
                <span>Total billing</span>
                <strong>{formatMoney(summary.totalBilled)}</strong>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-header">
              <h2>Billing status</h2>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Customer</th>
                    <th>Package</th>
                    <th className="col-num">Amount</th>
                    <th className="col-num">Paid</th>
                    <th className="col-num">Balance</th>
                    <th className="col-num">Overpaid</th>
                    <th>Status</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.billing || []).length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-state">
                        No billing records for this month.
                      </td>
                    </tr>
                  )}
                  {(data.billing || []).map((row, index) => (
                    <tr key={row.billing_id}>
                      <td className="serial-cell">
                        {index + 1}
                      </td>
                      <td>
                        <strong>{row.customer_name}</strong>
                        <div className="muted">{row.stb_number}</div>
                      </td>
                      <td>{row.package_name}</td>
                      <td className="col-num">
                        {formatMoney(row.monthly_amount)}
                      </td>
                      <td className="col-num">
                        {formatMoney(row.total_paid)}
                      </td>
                      <td className="col-num">
                        {formatMoney(row.balance_amount)}
                      </td>
                      <td className="col-num">
                        {formatMoney(getOverpaidAmount(row))}
                      </td>
                      <td>
                        <span className={statusClass(row.payment_status)}>
                          {row.payment_status}
                        </span>
                      </td>
                      <td>{row.assigned_user_name || row.assigned_username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Recent payments</h2>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th className="col-num">Amount</th>
                    <th>Collected by</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentPayments || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        No recent payments.
                      </td>
                    </tr>
                  )}
                  {(data.recentPayments || []).map((payment, index) => (
                    <tr key={payment.id}>
                      <td className="serial-cell">
                        {index + 1}
                      </td>
                      <td>{normalizeDate(payment.payment_date)}</td>
                      <td>{payment.customer_name}</td>
                      <td className="col-num">
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
