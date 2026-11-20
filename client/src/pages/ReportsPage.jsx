import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Search,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import {
  getBillingReport,
  getCustomersReport,
} from "../api/reports";
import { getPackages } from "../api/packages";
import { getPlaces } from "../api/places";
import CollectPaymentModal from "../components/CollectPaymentModal";
import { useAuth } from "../context/AuthContext";
import {
  formatMoney,
  getCurrentBillingMonth,
  getOverpaidAmount,
  normalizeDate,
  statusClass,
} from "../utils/format";
import {
  downloadCustomersExcel,
  downloadCustomersPdf,
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

function CustomerReportTable({
  customers,
  emptyText,
  onCollect,
}) {
  const columnCount = 14;

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
            <th>Package</th>
            <th className="col-num">Monthly amount</th>
            <th>Assigned</th>
            <th>Overdue month</th>
            <th className="col-num">Balance</th>
            <th>Remarks</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="empty-state">
                {emptyText}
              </td>
            </tr>
          )}
          {customers.map((row, index) => (
            <tr key={row.id}>
              <td className="serial-cell">{index + 1}</td>
              <td>{row.customer_name}</td>
              <td>{row.stb_number}</td>
              <td>{row.phone || "-"}</td>
              <td>
                {row.place ||
                  row.place_name ||
                  "-"}
              </td>
              <td>{row.package_name || "-"}</td>
              <td className="col-num">
                {formatMoney(row.package_monthly_amount)}
              </td>
              <td>
                {row.assigned_user_name ||
                  row.assigned_username ||
                  "-"}
              </td>
              <td>{normalizeDate(row.overdue_month)}</td>
              <td className="col-num">
                {formatMoney(row.outstanding_balance)}
              </td>
              <td>{row.remarks || "-"}</td>
              <td>
                {row.is_active ? (
                  <span className="status-pill status-paid">
                    Active
                  </span>
                ) : Number(row.overdue_amount || 0) > 0 ? (
                  <span className="status-pill status-unpaid">
                    In arrears
                  </span>
                ) : (
                  <span className="status-pill status-unpaid">
                    Inactive
                  </span>
                )}
              </td>
              <td>{normalizeDate(row.created_at)}</td>
              <td>
                {!row.is_active &&
                  Number(row.overdue_amount || 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onCollect?.(row)}
                    >
                      <IndianRupee size={14} aria-hidden="true" />
                      Pay arrears{" "}
                      {formatMoney(row.overdue_amount)}
                    </button>
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
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  // All-customers directory state (admin only)
  const [allCustomers, setAllCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] =
    useState(true);
  const [customerError, setCustomerError] = useState("");
  const [customerSearch, setCustomerSearch] =
    useState("");
  const [customerPlace, setCustomerPlace] =
    useState("all");
  const [customerPackage, setCustomerPackage] =
    useState("all");
  const [customerStatus, setCustomerStatus] =
    useState("all");
  const [placeChoices, setPlaceChoices] = useState([]);
  const [packageChoices, setPackageChoices] = useState([]);
  const [paymentTarget, setPaymentTarget] = useState(null);

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

  const loadCustomers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setCustomersLoading(true);
      setCustomerError("");

      const [customers, places, packages] =
        await Promise.all([
          getCustomersReport({ includeInactive: true }),
          getPlaces({ includeInactive: true }),
          getPackages({ includeInactive: true }),
        ]);

      setAllCustomers(customers);
      setPlaceChoices(places);
      setPackageChoices(packages);
    } catch (err) {
      setCustomerError(
        err.response?.data?.error?.message ||
          "Unable to load customers."
      );
    } finally {
      setCustomersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Debounce the search box so large customer lists do not re-filter on
  // every keystroke.
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] =
    useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch);
    }, 250);

    return () => clearTimeout(timer);
  }, [customerSearch]);

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

  const filteredCustomers = useMemo(() => {
    const term = debouncedCustomerSearch.trim().toLowerCase();

    return allCustomers.filter((row) => {
      if (term) {
        const haystack = [
          row.customer_name,
          row.stb_number,
          row.phone,
          row.place,
          row.place_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      if (
        customerPlace !== "all" &&
        row.place_id !== customerPlace
      ) {
        return false;
      }

      if (
        customerPackage !== "all" &&
        row.package_id !== customerPackage
      ) {
        return false;
      }

      if (customerStatus === "active" && !row.is_active) {
        return false;
      }

      if (customerStatus === "inactive" && row.is_active) {
        return false;
      }

      return true;
    });
  }, [
    allCustomers,
    debouncedCustomerSearch,
    customerPlace,
    customerPackage,
    customerStatus,
  ]);

  const customerCounts = useMemo(() => {
    const places = new Set();
    let active = 0;
    let inactive = 0;

    for (const row of allCustomers) {
      if (row.is_active) active += 1;
      else inactive += 1;
      if (row.place_id) places.add(row.place_id);
    }

    return { active, inactive, places: places.size };
  }, [allCustomers]);

  const deactivatedBalance = useMemo(
    () =>
      allCustomers.reduce(
        (sum, row) =>
          row.is_active
            ? sum
            : sum + Number(row.overdue_amount || 0),
        0
      ),
    [allCustomers]
  );

  function handleCollectFromReport(row) {
    setPaymentTarget({
      customer: row,
      bill: null,
      mode: "arrears",
    });
  }

  function openCustomersWithStatus(status) {
    setDownloadError("");
    setCustomerError("");
    setSelectedStatus(null);
    setCustomerStatus(status);
    setShowAllCustomers(true);
  }

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

  async function handleCustomerDownload(format) {
    if (
      customersLoading ||
      filteredCustomers.length === 0 ||
      exporting
    ) {
      return;
    }

    setCustomerError("");
    setExporting(format);

    try {
      if (format === "excel") {
        await downloadCustomersExcel({
          customers: filteredCustomers,
          fileName: "all-customers.xlsx",
        });
      } else {
        const downloaded = await downloadCustomersPdf({
          customers: filteredCustomers,
          fileName: "all-customers.pdf",
        });

        if (!downloaded) {
          setCustomerError(
            "No customers found for this report."
          );
        }
      }
    } catch {
      setCustomerError(
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
          {(selectedStatus || showAllCustomers) && (
            <button
              type="button"
              className="btn btn-secondary report-back"
              onClick={() => {
                setDownloadError("");
                setCustomerError("");
                setSelectedStatus(null);
                setShowAllCustomers(false);
              }}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back to reports
            </button>
          )}
          <h1>
            {showAllCustomers
              ? customerStatus === "active"
                ? "Active Customers"
                : customerStatus === "inactive"
                  ? "Deactivated Customers"
                  : "All Customers"
              : activeReport
                ? activeReport.title
                : "Reports"}
          </h1>
          <p>
            {showAllCustomers
              ? customerStatus === "inactive"
                ? "STBs with unpaid past months and their pending balance."
                : "Every customer with full details and filters."
              : activeReport
                ? "Filtered customer list and collection totals."
                : "Choose a report to open its customer list."}
          </p>
        </div>

        {(selectedStatus || showAllCustomers) && (
          <div className="report-download-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                showAllCustomers
                  ? handleCustomerDownload("excel")
                  : handleDownload("excel")
              }
              disabled={
                (showAllCustomers
                  ? customersLoading ||
                    !filteredCustomers.length
                  : loading || !detailRecords.length) ||
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
              onClick={() =>
                showAllCustomers
                  ? handleCustomerDownload("pdf")
                  : handleDownload("pdf")
              }
              disabled={
                (showAllCustomers
                  ? customersLoading ||
                    !filteredCustomers.length
                  : loading || !detailRecords.length) ||
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

      {!showAllCustomers && (
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
      )}

      {!showAllCustomers && (
        <p className="muted report-hint">
          Bills for the selected months are included, plus any
          older bill paid inside the range. Payments are counted
          only inside the range.
        </p>
      )}

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="muted">Loading report...</p>}

      {!selectedStatus && !showAllCustomers && (
        <div className="report-grid">
          {!loading && !error && report && STATUS_REPORTS.map((item, index) => (
            <ReportCard
              key={item.status}
              report={item}
              records={groupedRecords[item.status]}
              delay={index * 70}
              onOpen={() => {
                setDownloadError("");
                setCustomerError("");
                setShowAllCustomers(false);
                setSelectedStatus(item.status);
              }}
            />
          ))}

          <article
            className="report-card report-card--all"
            style={{
              "--delay": `${STATUS_REPORTS.length * 70}ms`,
            }}
          >
            <div className="report-card-header">
              <div className="report-card-heading">
                <span
                  className="report-card-icon"
                  aria-hidden="true"
                >
                  <Users size={19} strokeWidth={2} />
                </span>
                <h2>All Customers</h2>
              </div>
              <span>{allCustomers.length}</span>
            </div>

            <div className="report-card-body">
              <p>
                Every customer with full details. Search by STB
                or name, and filter by place, package or status.
              </p>

              <dl className="report-card-amounts">
                <div>
                  <dt>Active</dt>
                  <dd>{customerCounts.active}</dd>
                </div>
                <div>
                  <dt>Inactive</dt>
                  <dd>{customerCounts.inactive}</dd>
                </div>
                <div>
                  <dt>Places</dt>
                  <dd>{customerCounts.places}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="report-card-link"
                onClick={() => {
                  setDownloadError("");
                  setCustomerError("");
                  setSelectedStatus(null);
                  setCustomerStatus("all");
                  setShowAllCustomers(true);
                }}
              >
                Open report
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </article>

          <article
            className="report-card report-card--active"
            style={{
              "--delay": `${(STATUS_REPORTS.length + 1) * 70}ms`,
            }}
          >
            <div className="report-card-header">
              <div className="report-card-heading">
                <span
                  className="report-card-icon"
                  aria-hidden="true"
                >
                  <UserCheck size={19} strokeWidth={2} />
                </span>
                <h2>Active Customers</h2>
              </div>
              <span>{customerCounts.active}</span>
            </div>

            <div className="report-card-body">
              <p>
                No overdue months. New bills can be generated for
                these customers.
              </p>

              <dl className="report-card-amounts">
                <div>
                  <dt>Total customers</dt>
                  <dd>{allCustomers.length}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="report-card-link"
                onClick={() =>
                  openCustomersWithStatus("active")
                }
              >
                Open report
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </article>

          <article
            className="report-card report-card--deactivated"
            style={{
              "--delay": `${(STATUS_REPORTS.length + 2) * 70}ms`,
            }}
          >
            <div className="report-card-header">
              <div className="report-card-heading">
                <span
                  className="report-card-icon"
                  aria-hidden="true"
                >
                  <UserX size={19} strokeWidth={2} />
                </span>
                <h2>Deactivated Customers</h2>
              </div>
              <span>{customerCounts.inactive}</span>
            </div>

            <div className="report-card-body">
              <p>
                STBs with a past month still unpaid. No new bill is
                generated until the pending amount is paid.
              </p>

              <dl className="report-card-amounts">
                <div>
                  <dt>Overdue amount</dt>
                  <dd>{formatMoney(deactivatedBalance)}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="report-card-link"
                onClick={() =>
                  openCustomersWithStatus("inactive")
                }
              >
                Open report
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </article>
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

      {showAllCustomers && (
      <div className="panel customer-report-panel">
        <div className="panel-header">
          <h2>All Customers</h2>
          <span className="muted">
            {filteredCustomers.length} of {allCustomers.length}{" "}
            customers
          </span>
        </div>

        <div className="toolbar report-filters">
          <label className="field search-field">
            <span>STB / Name</span>
            <div className="input-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                className="search-input"
                placeholder="Search STB, name, phone or place..."
                value={customerSearch}
                onChange={(event) =>
                  setCustomerSearch(event.target.value)
                }
              />
            </div>
          </label>

          <label className="field">
            <span>Place</span>
            <select
              className="select"
              value={customerPlace}
              onChange={(event) =>
                setCustomerPlace(event.target.value)
              }
            >
              <option value="all">All places</option>
              {placeChoices.map((place) => (
                <option
                  key={place.id}
                  value={place.id}
                >
                  {place.place_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Package</span>
            <select
              className="select"
              value={customerPackage}
              onChange={(event) =>
                setCustomerPackage(event.target.value)
              }
            >
              <option value="all">All packages</option>
              {packageChoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.package_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select
              className="select"
              value={customerStatus}
              onChange={(event) =>
                setCustomerStatus(event.target.value)
              }
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

        </div>

        {customerError && (
          <p className="error-message">{customerError}</p>
        )}
        {customersLoading && (
          <p className="muted">Loading customers...</p>
        )}
        {!customersLoading && (
          <CustomerReportTable
            customers={filteredCustomers}
            emptyText="No customers match the selected filters."
            onCollect={handleCollectFromReport}
          />
        )}
      </div>
      )}

      {paymentTarget && (
        <CollectPaymentModal
          open
          mode={paymentTarget.mode || "bill"}
          customer={paymentTarget.customer}
          bill={paymentTarget.bill}
          onClose={() => setPaymentTarget(null)}
          onSuccess={async () => {
            setPaymentTarget(null);
            await loadCustomers();
          }}
        />
      )}
    </section>
  );
}
