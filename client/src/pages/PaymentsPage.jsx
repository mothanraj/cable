import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Pencil,
  Receipt,
  Search,
  TrendingUp,
} from "lucide-react";
import { getPayments } from "../api/payments";
import CollectorFilter from "../components/CollectorFilter";
import EditPaymentModal from "../components/EditPaymentModal";
import { useAuth } from "../context/AuthContext";
import { useDataRefresh } from "../context/DataRefreshContext";
import {
  formatDateValue,
  formatMoney,
  getMonthRange,
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

function collectorOf(payment) {
  return (
    payment.created_by_name ||
    payment.created_by_username ||
    "-"
  );
}

function placeOf(payment) {
  return payment.place && payment.place.trim()
    ? payment.place
    : "Unassigned";
}

function packageOf(payment) {
  return payment.package_name || "Unassigned";
}

function sortedOptions(values) {
  return [...new Set(values)].sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const { version } = useDataRefresh();
  const isAdmin = user?.role === "ADMIN";

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingPayment, setEditingPayment] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [place, setPlace] = useState("all");
  const [packageName, setPackageName] = useState("all");
  const [collectorUserId, setCollectorUserId] = useState("");

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getPayments({ collectorUserId });
      setPayments(rows);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load payments."
      );
    } finally {
      setLoading(false);
    }
  }, [collectorUserId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments, version]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const placeOptions = useMemo(
    () => sortedOptions(payments.map(placeOf)),
    [payments]
  );

  const packageOptions = useMemo(
    () => sortedOptions(payments.map(packageOf)),
    [payments]
  );

  const filteredPayments = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    return payments.filter((payment) => {
      if (term) {
        const haystack = [
          payment.customer_name,
          payment.stb_number,
          payment.phone,
          payment.place,
          payment.package_name,
          payment.remarks,
          collectorOf(payment),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      const paymentDate = normalizeDate(payment.payment_date);

      if (from && paymentDate < from) return false;
      if (to && paymentDate > to) return false;

      if (place !== "all" && placeOf(payment) !== place) {
        return false;
      }

      if (
        packageName !== "all" &&
        packageOf(payment) !== packageName
      ) {
        return false;
      }

      return true;
    });
  }, [
    payments,
    debouncedSearch,
    from,
    to,
    place,
    packageName,
  ]);

  const totals = useMemo(() => {
    const total = filteredPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.collected_amount || 0),
      0
    );

    return {
      total,
      count: filteredPayments.length,
      average: filteredPayments.length
        ? total / filteredPayments.length
        : 0,
    };
  }, [filteredPayments]);

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

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setPlace("all");
    setPackageName("all");
    setCollectorUserId("");
  }

  const dateError = Boolean(from && to && from > to);

  return (
    <section className="page page--payments">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Payment ledger for accessible customers.</p>
        </div>
      </div>

      {success && <p className="success-toast">{success}</p>}
      {error && <p className="error-message">{error}</p>}
      {loading && <div className="loading-block">Loading payments...</div>}

      {!loading && !error && (
        <>
          <div className="toolbar report-filters">
            <label className="field search-field">
              <span>Search</span>
              <div className="input-with-icon">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  className="search-input"
                  placeholder="Customer, STB, phone, package or remarks..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>From</span>
              <input
                type="date"
                className="input"
                value={from}
                max={to || undefined}
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
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Place</span>
              <select
                className="select"
                value={place}
                onChange={(event) =>
                  setPlace(event.target.value)
                }
              >
                <option value="all">All places</option>
                {placeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Package</span>
              <select
                className="select"
                value={packageName}
                onChange={(event) =>
                  setPackageName(event.target.value)
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

            <CollectorFilter
              value={collectorUserId}
              onChange={setCollectorUserId}
            />

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
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          </div>

          {dateError && (
            <p className="error-message">
              From date must be on or before to date.
            </p>
          )}

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
                {filteredPayments.length} of {payments.length}{" "}
                entries
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-state">
                        {payments.length === 0
                          ? "No payments found."
                          : "No payments match the filters."}
                      </td>
                    </tr>
                  )}
                  {filteredPayments.map((payment, index) => (
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
                      <td>{collectorOf(payment)}</td>
                      <td>{payment.remarks || "-"}</td>
                      <td>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSuccess("");
                              setEditingPayment(payment);
                            }}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit amount
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingPayment && (
        <EditPaymentModal
          open
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSuccess={async () => {
            setSuccess(
              "Payment corrected. Bill totals and payment status have been recalculated."
            );
            await loadPayments();
          }}
        />
      )}
    </section>
  );
}
