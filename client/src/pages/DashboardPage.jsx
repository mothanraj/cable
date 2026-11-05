import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboard } from "../api/dashboard";
import StatCard from "../components/StatCard";
import {
  formatMoney,
  getCurrentBillingMonth,
  getOverpaidAmount,
  normalizeDate,
  statusClass,
} from "../utils/format";

const STATUS_META = [
  {
    key: "paid",
    label: "Paid",
    dot: "paid",
    color: "#10b981",
  },
  {
    key: "overpaid",
    label: "Overpaid",
    dot: "overpaid",
    color: "#8b5cf6",
  },
  {
    key: "partial",
    label: "Partial",
    dot: "partial",
    color: "#f59e0b",
  },
  {
    key: "unpaid",
    label: "Unpaid",
    dot: "unpaid",
    color: "#f43f5e",
  },
];

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
      if (row.is_effective === false) {
        continue;
      }

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

  const statusCounts = useMemo(
    () => ({
      paid: summary?.paidCount ?? 0,
      overpaid: summary?.overpaidCount ?? 0,
      partial: summary?.partialCount ?? 0,
      unpaid: summary?.unpaidCount ?? 0,
    }),
    [summary]
  );

  const donutTotal = STATUS_META.reduce(
    (sum, item) => sum + Number(statusCounts[item.key] || 0),
    0
  );

  const donutGradient = useMemo(() => {
    if (!donutTotal) return "#e9edf9";

    let cursor = 0;
    const stops = STATUS_META.map((item) => {
      const value = Number(statusCounts[item.key] || 0);
      const start = (cursor / donutTotal) * 100;
      cursor += value;
      const end = (cursor / donutTotal) * 100;
      return `${item.color} ${start}% ${end}%`;
    });

    return `conic-gradient(${stops.join(", ")})`;
  }, [donutTotal, statusCounts]);

  const collectionRate = summary?.totalBilled
    ? Math.round(
        (Number(summary.totalCollected) /
          Number(summary.totalBilled)) *
          100
      )
    : 0;

  return (
    <section className="page page--dashboard">
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

      {loading && (
        <div className="stats-grid stats-grid--dashboard">
          {[0, 1, 2, 3].map((item) => (
            <div
              className="skeleton skeleton-card"
              key={item}
            />
          ))}
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <div className="dashboard-stats">
            <p className="stat-group-label">Collection status</p>
            <div className="stats-grid stats-grid--dashboard">
              <StatCard
                label="Paid"
                count={summary.paidCount}
                icon={CheckCircle2}
                tone="emerald"
                delay={0}
                hint={`${formatMoney(
                  statusTotals.PAID
                )} collected`}
              />
              <StatCard
                label="Overpaid"
                count={summary.overpaidCount ?? 0}
                icon={TrendingUp}
                tone="violet"
                delay={60}
                hint={`${formatMoney(
                  statusTotals.OVERPAID
                )} excess`}
              />
              <StatCard
                label="Unpaid"
                count={summary.unpaidCount}
                icon={AlertCircle}
                tone="rose"
                delay={120}
                hint={`${formatMoney(statusTotals.UNPAID)} due`}
              />
              <StatCard
                label="Partial"
                count={summary.partialCount}
                icon={CircleDashed}
                tone="amber"
                delay={180}
                hint={`${formatMoney(
                  statusTotals.PARTIAL
                )} due`}
              />
            </div>

            <p className="stat-group-label">This month</p>
            <div className="stats-grid stats-grid--dashboard">
              <StatCard
                label="Total customers"
                count={summary.totalCustomers}
                icon={Users}
                tone="cyan"
                delay={0}
              />
              <StatCard
                label="Collected (month)"
                count={Number(summary.totalCollected || 0)}
                format={(value) => formatMoney(value)}
                icon={Wallet}
                tone="indigo"
                delay={60}
                hint="Payments recorded this month"
              />
              <StatCard
                label="Pending (month)"
                count={Number(summary.totalOutstanding || 0)}
                format={(value) => formatMoney(value)}
                icon={Clock3}
                tone="rose"
                delay={120}
                hint="Still to be collected"
              />
              <StatCard
                label="Total billing"
                count={Number(summary.totalBilled || 0)}
                format={(value) => formatMoney(value)}
                icon={ReceiptText}
                tone="blue"
                delay={180}
                hint="Expected for the month"
              />
            </div>
          </div>

          <div className="panel health-panel">
            <div className="panel-header">
              <h2>Collection health</h2>
              <span className="muted">
                {billingMonth.slice(0, 7)}
              </span>
            </div>

            <div className="health-body">
              <div
                className="donut-wrap"
                style={{ "--donut": donutGradient }}
              >
                <div className="donut" aria-hidden="true" />
                <div className="donut-center">
                  <strong>{donutTotal}</strong>
                  <span>Bills</span>
                </div>
              </div>

              <div className="health-legend">
                {STATUS_META.map((item) => {
                  const value = Number(
                    statusCounts[item.key] || 0
                  );
                  const percent = donutTotal
                    ? Math.round((value / donutTotal) * 100)
                    : 0;

                  return (
                    <div
                      className="health-legend-row"
                      key={item.key}
                    >
                      <span
                        className={`legend-dot legend-dot--${item.dot}`}
                        aria-hidden="true"
                      />
                      <span className="health-legend-label">
                        {item.label}
                      </span>
                      <span className="health-legend-value">
                        {value}
                      </span>
                      <span className="health-legend-pct">
                        {percent}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="health-insights">
                <div className="health-insight">
                  <span>Collection rate</span>
                  <strong>{collectionRate}%</strong>
                  <small>of billed amount collected</small>
                </div>
                <div className="health-insight">
                  <span>Outstanding</span>
                  <strong>
                    {formatMoney(summary.totalOutstanding)}
                  </strong>
                  <small>across partial and unpaid bills</small>
                </div>
              </div>
            </div>
          </div>

          <div
            className="panel"
            style={{ marginBottom: 18 }}
          >
            <div className="panel-header">
              <h2>Billing status</h2>
              <span className="muted">
                {(data.billing || []).length} records
              </span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Customer</th>
                    <th>Package</th>
                    <th className="col-num">Amount</th>
                    <th className="col-num">Arrears</th>
                    <th className="col-num">Due</th>
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
                      <td colSpan={11} className="empty-state">
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
                        <div className="muted">
                          {row.stb_number}
                        </div>
                      </td>
                      <td>{row.package_name}</td>
                      <td className="col-num">
                        {formatMoney(row.monthly_amount)}
                      </td>
                      <td className="col-num">
                        {formatMoney(
                          Number(row.arrears_amount || 0)
                        )}
                      </td>
                      <td className="col-num">
                        {formatMoney(
                          Number(
                            row.due_amount ??
                              Number(row.monthly_amount || 0) +
                                Number(row.arrears_amount || 0)
                          )
                        )}
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
                        {row.is_effective === false ? (
                          <span className="status-pill status-carried">
                            Carried forward
                          </span>
                        ) : (
                          <span className={statusClass(row.payment_status)}>
                            {row.payment_status}
                          </span>
                        )}
                      </td>
                      <td>
                        {row.assigned_user_name ||
                          row.assigned_username}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Recent payments</h2>
              <span className="muted">
                Latest activity
              </span>
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
                  {(data.recentPayments || []).map(
                    (payment, index) => (
                      <tr key={payment.id}>
                        <td className="serial-cell">
                          {index + 1}
                        </td>
                        <td>
                          {normalizeDate(payment.payment_date)}
                        </td>
                        <td>{payment.customer_name}</td>
                        <td className="col-num amount-strong">
                          {formatMoney(payment.collected_amount)}
                        </td>
                        <td>
                          {payment.created_by_name ||
                            payment.created_by_username}
                        </td>
                        <td>{payment.remarks || "-"}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
