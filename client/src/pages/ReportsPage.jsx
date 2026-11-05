import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { getBillingReport } from "../api/reports";
import { useAuth } from "../context/AuthContext";
import {
  formatMoney,
  getCurrentBillingMonth,
  getOverpaidAmount,
  normalizeDate,
  statusClass,
} from "../utils/format";
import {
  downloadReportExcel,
  downloadStbPdf,
} from "../utils/reportDownloads";

const STATUS_REPORTS = [
  {
    status: "PAID",
    title: "Paid Customers",
    icon: CheckCircle2,
    description:
      "Customers whose bill is fully settled for the selected period.",
    className: "report-card--paid",
    emptyText: "No fully paid customers for this period.",
  },
  {
    status: "OVERPAID",
    title: "Overpaid Customers",
    icon: TrendingUp,
    description:
      "Customers who paid more than the package amount for the selected period.",
    className: "report-card--overpaid",
    emptyText: "No overpaid customers for this period.",
  },
  {
    status: "PARTIAL",
    title: "Partial Paid Customers",
    icon: CircleDashed,
    description:
      "Customers who paid something but still have an outstanding balance.",
    className: "report-card--partial",
    emptyText: "No partially paid customers for this period.",
  },
  {
    status: "UNPAID",
    title: "Unpaid Customers",
    icon: XCircle,
    description:
      "Customers with no payment recorded in the selected period.",
    className: "report-card--unpaid",
    emptyText: "No unpaid customers for this period.",
  },
];

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth() + offset,
    1
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offset + 1,
    0
  );

  return {
    from: formatDateValue(start),
    to: formatDateValue(end),
  };
}

function sumField(records, key) {
  return records.reduce(
    (sum, row) => sum + Number(row[key] || 0),
    0
  );
}

function summarize(records) {
  const effective = records.filter(
    (row) => row.is_effective !== false
  );
  return {
    count: effective.length,
    totalBilled: sumField(effective, "due_amount"),
    totalCollected: sumField(effective, "total_paid"),
    totalOutstanding: sumField(
      effective,
      "balance_amount"
    ),
    totalOverpaid: effective.reduce(
      (sum, row) =>
        sum + getOverpaidAmount(row),
      0
    ),
  };
}

function ReportTable({
  records,
  emptyText,
  showBillingMonth = false,
  showLastPayment = false,
}) {
  const columnCount =
    14 + (showBillingMonth ? 1 : 0) + (showLastPayment ? 1 : 0);

  return (
    <div className="table-wrap">
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Customer</th>
            <th>STB</th>
            <th>Phone</th>
            <th>Place</th>
            <th>Assigned</th>
            <th>Package</th>
            {showBillingMonth && <th>Billing month</th>}
            <th className="col-num">Amount</th>
            <th className="col-num">Arrears</th>
            <th className="col-num">Due</th>
            <th className="col-num">Paid</th>
            <th className="col-num">Balance</th>
            <th className="col-num">Overpaid</th>
            {showLastPayment && <th>Last payment</th>}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="empty-state">
                {emptyText}
              </td>
            </tr>
          )}
          {records.map((row, index) => (
            <tr key={row.billing_id}>
              <td className="serial-cell">{index + 1}</td>
              <td>{row.customer_name}</td>
              <td>{row.stb_number}</td>
              <td>{row.phone || "-"}</td>
              <td>{row.place || "-"}</td>
              <td>
                {row.assigned_user_name ||
                  row.assigned_username}
              </td>
              <td>{row.package_name}</td>
              {showBillingMonth && (
                <td>{normalizeDate(row.billing_month)}</td>
              )}
              <td className="col-num">
                {formatMoney(row.monthly_amount)}
              </td>
              <td className="col-num">
                {formatMoney(row.arrears_amount)}
              </td>
              <td className="col-num">
                {formatMoney(
                  row.due_amount ??
                    Number(row.monthly_amount || 0) +
                      Number(row.arrears_amount || 0)
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
              {showLastPayment && (
                <td>
                  {row.last_payment_date
                    ? normalizeDate(row.last_payment_date)
                    : "-"}
                </td>
              )}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportCard({ report, records, onOpen, delay = 0 }) {
  const stats = summarize(records);
  const Icon = report.icon;

  return (
    <article
      className={`report-card ${report.className}`}
      style={{ "--delay": `${delay}ms` }}
    >
      <div className="report-card-header">
        <div className="report-card-heading">
          <span
            className="report-card-icon"
            aria-hidden="true"
          >
            {Icon && <Icon size={19} strokeWidth={2} />}
          </span>
          <h2>{report.title}</h2>
        </div>
        <span>{stats.count}</span>
      </div>

      <div className="report-card-body">
        <p>{report.description}</p>

        <dl className="report-card-amounts">
          <div>
            <dt>Billed</dt>
            <dd>{formatMoney(stats.totalBilled)}</dd>
          </div>
          <div>
            <dt>Collected</dt>
            <dd>{formatMoney(stats.totalCollected)}</dd>
          </div>
          <div>
            <dt>
              {report.status === "OVERPAID"
                ? "Overpaid"
                : "Outstanding"}
            </dt>
            <dd>
              {formatMoney(
                report.status === "OVERPAID"
                  ? stats.totalOverpaid
                  : stats.totalOutstanding
              )}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="report-card-link"
          onClick={onOpen}
        >
          Open report
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [billingMonth, setBillingMonth] = useState(
    getCurrentBillingMonth()
  );
  const [from, setFrom] = useState(
    () => getMonthRange(0).from
  );
  const [to, setTo] = useState(() => getMonthRange(0).to);
  const [placeFilter, setPlaceFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        if (isAdmin && (!from || !to)) {
          setError("Select both from and to dates.");
          return;
        }

        if (isAdmin && from > to) {
          setError("From date must be on or before to date.");
          return;
        }

        const data = isAdmin
          ? await getBillingReport({ from, to })
          : await getBillingReport({ billingMonth });

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
  }, [isAdmin, from, to, billingMonth]);

  const summary = report?.summary;

  const records = useMemo(
    () => report?.records || [],
    [report]
  );

  const placeOptions = useMemo(() => {
    const places = new Set();

    for (const row of records) {
      places.add(
        row.place && row.place.trim()
          ? row.place
          : "Unassigned"
      );
    }

    return [...places].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [records]);

  const packageOptions = useMemo(() => {
    const packages = new Set();

    for (const row of records) {
      if (row.package_name) {
        packages.add(row.package_name);
      }
    }

    return [...packages].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [records]);

  const effectivePlace =
    placeFilter === "all" ||
    placeOptions.includes(placeFilter)
      ? placeFilter
      : "all";

  const effectivePackage =
    packageFilter === "all" ||
    packageOptions.includes(packageFilter)
      ? packageFilter
      : "all";

  const filteredRecords = useMemo(
    () =>
      records.filter((row) => {
        const place =
          row.place && row.place.trim()
            ? row.place
            : "Unassigned";

        if (
          effectivePlace !== "all" &&
          place !== effectivePlace
        ) {
          return false;
        }

        if (
          effectivePackage !== "all" &&
          row.package_name !== effectivePackage
        ) {
          return false;
        }

        return true;
      }),
    [records, effectivePlace, effectivePackage]
  );

  const groupedRecords = useMemo(
    () => {
      const effective = records.filter(
        (row) => row.is_effective !== false
      );
      return {
        PAID: effective.filter(
          (row) => row.payment_status === "PAID"
        ),
        OVERPAID: effective.filter(
          (row) => row.payment_status === "OVERPAID"
        ),
        PARTIAL: effective.filter(
          (row) => row.payment_status === "PARTIAL"
        ),
        UNPAID: effective.filter(
          (row) => row.payment_status === "UNPAID"
        ),
      };
    },
    [records]
  );

  const activeReport = STATUS_REPORTS.find(
    (item) => item.status === selectedStatus
  );

  const detailRecords = selectedStatus
    ? groupedRecords[selectedStatus] || []
    : [];

  const detailSummary = summarize(detailRecords);

  function applyPreset(preset) {
    if (preset === "today") {
      const today = formatDateValue(new Date());
      setFrom(today);
      setTo(today);
      return;
    }

    const range = getMonthRange(
      preset === "last-month" ? -1 : 0
    );

    setFrom(range.from);
    setTo(range.to);
  }

  function resetFilters() {
    const range = getMonthRange(0);
    setFrom(range.from);
    setTo(range.to);
    setPlaceFilter("all");
    setPackageFilter("all");
  }

  async function handleDownload(format) {
    const exportRecords = isAdmin ? detailRecords : records;

    if (loading || exportRecords.length === 0 || exporting) {
      return;
    }

    const period = isAdmin
      ? `${from}_to_${to}`
      : billingMonth.slice(0, 7);
    const reportKey = isAdmin
      ? (selectedStatus || "report").toLowerCase()
      : "billing";

    setDownloadError("");
    setExporting(format);

    try {
      if (format === "excel") {
        await downloadReportExcel({
          records: exportRecords,
          includeBillingMonth: isAdmin,
          includeLastPayment: isAdmin,
          fileName: `${reportKey}-${period}.xlsx`,
          sheetName: isAdmin
            ? activeReport?.title || "Report"
            : "Billing Report",
        });
      } else {
        const downloaded = await downloadStbPdf({
          records: exportRecords,
          fileName: `${reportKey}-stb-${period}.pdf`,
        });

        if (!downloaded) {
          setDownloadError(
            "No STB numbers found for this report."
          );
        }
      }
    } catch {
      setDownloadError(
        "Unable to generate the download. Please try again."
      );
    } finally {
      setExporting(null);
    }
  }

  if (!isAdmin) {
    return (
      <section className="page page--reports">
        <div className="page-header">
          <div>
            <h1>Billing Report</h1>
            <p>Monthly billing and collection report.</p>
          </div>
          <div className="report-download-actions">
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleDownload("excel")}
              disabled={
                loading || !records.length || exporting !== null
              }
            >
              <FileSpreadsheet size={16} />
              {exporting === "excel"
                ? "Preparing..."
                : "Download Excel"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleDownload("pdf")}
              disabled={
                loading || !records.length || exporting !== null
              }
            >
              <FileText size={16} />
              {exporting === "pdf"
                ? "Preparing..."
                : "Download STB PDF"}
            </button>
          </div>
        </div>

        {downloadError && (
          <p className="error-message">{downloadError}</p>
        )}
        {error && <p className="error-message">{error}</p>}
        {loading && <p className="muted">Loading report...</p>}

        {!loading && !error && summary && (
          <>
            <div className="stats-grid stats-grid--summary">
              <div className="stat-card">
                <span>Customers</span>
                <strong>{summary.totalCustomers}</strong>
              </div>
              <div className="stat-card">
                <span>Billed</span>
                <strong>
                  {formatMoney(summary.totalBilled)}
                </strong>
              </div>
              <div className="stat-card">
                <span>Collected</span>
                <strong>
                  {formatMoney(summary.totalCollected)}
                </strong>
              </div>
              <div className="stat-card">
                <span>Outstanding</span>
                <strong>
                  {formatMoney(summary.totalOutstanding)}
                </strong>
              </div>
              <div className="stat-card stat-card--counts">
                <span>Status totals</span>
                <strong>
                  {summary.paidCount} /{" "}
                  {summary.overpaidCount ?? 0} /{" "}
                  {summary.partialCount} /{" "}
                  {summary.unpaidCount}
                </strong>
                <small className="stat-card-value">
                  Paid / Overpaid / Partial / Unpaid
                </small>
              </div>
            </div>

            <div className="panel">
              <ReportTable
                records={records}
                emptyText="No records for this month."
              />
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="page page--reports">
      <div className="page-header">
        <div>
          {selectedStatus && (
            <button
              type="button"
              className="btn btn-secondary report-back"
              onClick={() => {
                setDownloadError("");
                setSelectedStatus(null);
              }}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back to reports
            </button>
          )}
          <h1>
            {activeReport
              ? activeReport.title
              : "Reports"}
          </h1>
          <p>
            {activeReport
              ? "Filtered customer list and collection totals."
              : "Choose a report to open its customer list."}
          </p>
        </div>

        {selectedStatus && (
          <div className="report-download-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleDownload("excel")}
              disabled={
                loading ||
                !detailRecords.length ||
                exporting !== null
              }
            >
              <FileSpreadsheet size={16} />
              {exporting === "excel"
                ? "Preparing..."
                : "Download Excel"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleDownload("pdf")}
              disabled={
                loading ||
                !detailRecords.length ||
                exporting !== null
              }
            >
              <FileText size={16} />
              {exporting === "pdf"
                ? "Preparing..."
                : "Download STB PDF"}
            </button>
          </div>
        )}
      </div>

      {downloadError && (
        <p className="error-message">{downloadError}</p>
      )}

      <div className="toolbar report-filters">
        <label className="field">
          <span>From</span>
          <input
            type="date"
            className="input"
            value={from}
            max={to}
            onChange={(event) =>
              setFrom(event.target.value)
            }
          />
        </label>

        <label className="field">
          <span>To</span>
          <input
            type="date"
            className="input"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Place</span>
          <select
            className="select"
            value={effectivePlace}
            onChange={(event) =>
              setPlaceFilter(event.target.value)
            }
          >
            <option value="all">All places</option>
            {placeOptions.map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Package</span>
          <select
            className="select"
            value={effectivePackage}
            onChange={(event) =>
              setPackageFilter(event.target.value)
            }
          >
            <option value="all">All packages</option>
            {packageOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="filter-row report-presets">
          <button
            type="button"
            className="filter-button"
            onClick={() => applyPreset("today")}
          >
            Today
          </button>
          <button
            type="button"
            className="filter-button"
            onClick={() => applyPreset("this-month")}
          >
            This month
          </button>
          <button
            type="button"
            className="filter-button"
            onClick={() => applyPreset("last-month")}
          >
            Last month
          </button>
          <button
            type="button"
            className="filter-button"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </div>

      <p className="muted report-hint">
        Bills for the selected months are included, plus any
        older bill paid inside the range. Payments are counted
        only inside the range.
      </p>

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="muted">Loading report...</p>}

      {!loading && !error && report && !selectedStatus && (
        <div className="report-grid">
          {STATUS_REPORTS.map((item, index) => (
            <ReportCard
              key={item.status}
              report={item}
              records={groupedRecords[item.status]}
              delay={index * 70}
              onOpen={() => {
                setDownloadError("");
                setSelectedStatus(item.status);
              }}
            />
          ))}
        </div>
      )}

      {!loading &&
        !error &&
        report &&
        selectedStatus &&
        activeReport && (
          <>
            <div className="stats-grid stats-grid--detail">
              <div className="stat-card">
                <span>Customers</span>
                <strong>{detailSummary.count}</strong>
              </div>
              <div className="stat-card">
                <span>Billed</span>
                <strong>
                  {formatMoney(detailSummary.totalBilled)}
                </strong>
              </div>
              <div className="stat-card">
                <span>Collected</span>
                <strong>
                  {formatMoney(
                    detailSummary.totalCollected
                  )}
                </strong>
              </div>
              <div className="stat-card">
                <span>Outstanding</span>
                <strong>
                  {formatMoney(
                    detailSummary.totalOutstanding
                  )}
                </strong>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>{activeReport.title}</h2>
                <span className="muted">
                  {from} to {to}
                </span>
              </div>
              <ReportTable
                records={detailRecords}
                emptyText={activeReport.emptyText}
                showBillingMonth
                showLastPayment
              />
            </div>
          </>
        )}
    </section>
  );
}
