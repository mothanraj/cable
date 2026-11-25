import { useEffect, useMemo, useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, IndianRupee, Pencil, Plus, ReceiptText, Search, Users } from "lucide-react";
import { generateBilling, generateBillingBulk, getBilling } from "../../api/billing";
import {
  createCustomer,
  getCustomers,
  reorderCustomers,
  updateCustomer,
} from "../../api/customers";
import { getPayments } from "../../api/payments";
import AdjustBillsModal from "../../components/AdjustBillsModal";
import CollectPaymentModal from "../../components/CollectPaymentModal";
import CollectorFilter from "../../components/CollectorFilter";
import CustomerFormModal from "../../components/CustomerFormModal";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import {
  combinedStatus,
  formatMoney,
  getCurrentBillingMonth,
  getToday,
  normalizeDate,
} from "../../utils/format";
import { getInitials } from "../../utils/names";

const FILTERS = {
  ALL: "all",
  PAID: "paid",
  OVERPAID: "overpaid",
  UNPAID: "unpaid",
  PARTIAL: "partial",
  TODAY: "today",
  MONTH: "month",
  DATE: "date",
};

function groupCustomersByPlace(list) {
  const map = new Map();
  for (const customer of list) {
    const key = customer.place_id || "unassigned";
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: customer.place || "Unassigned",
        customers: [],
      });
    }
    map.get(key).customers.push(customer);
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function SortableCustomerCard({
  customer,
  bill,
  paymentDates = [],
  billedThisMonth = false,
  serial,
  onEdit,
  onCollect,
  onAdjust,
  canAdjust = false,
  onGenerateBill,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  selected = false,
  onToggleSelect,
  dragDisabled = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: customer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const arrearsAmount = Number(customer.overdue_amount || 0);
  const inArrears = arrearsAmount > 0;
  const status = combinedStatus(bill, customer.is_active);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`customer-card ${isDragging ? "dragging" : ""} ${
        bill
          ? `customer-card--${bill.payment_status.toLowerCase()}`
          : "customer-card--none"
      }`}
    >
      {!dragDisabled && (
        <div className="move-buttons">
          <button
            type="button"
            className="move-button"
            aria-label="Move customer up"
            title="Move up"
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            className="move-button"
            aria-label="Move customer down"
            title="Move down"
            disabled={isLast}
            onClick={onMoveDown}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}

      {!dragDisabled && (
        <button
          type="button"
          className="drag-handle"
          aria-label="Reorder customer"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>
      )}

      <label className="card-checkbox" title="Select customer">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(customer.id)}
          aria-label={`Select ${customer.customer_name}`}
        />
      </label>

      <span className="avatar avatar--customer" aria-hidden="true">
        {getInitials(customer.customer_name)}
      </span>

      <div className="customer-meta">
        <h2>
          <span className="customer-serial">
            S.No {serial}
          </span>
          {customer.customer_name}
        </h2>
        {inArrears && (
          <span className="customer-deactivated-pill">
            Arrears
          </span>
        )}
        {inArrears && customer.overdue_month && (
          <p className="customer-overdue-line">
            Pending {normalizeDate(customer.overdue_month)} ·{" "}
            {formatMoney(arrearsAmount)}
          </p>
        )}
        {!inArrears && customer.is_active === false && (
          <span className="customer-deactivated-pill">
            Deactivated
          </span>
        )}
        {Number(customer.overpaid_amount || 0) > 0 && (
          <span className="customer-overpaid-pill">
            Overpaid ₹
            {Number(customer.overpaid_amount).toLocaleString(
              "en-IN",
              {
                maximumFractionDigits: 0,
              }
            )}
          </span>
        )}
        <p>STB: {customer.stb_number}</p>
        <p>Phone: {customer.phone || "-"}</p>
        <p>Place: {customer.place || "-"}</p>
        <p>Package: {customer.package_name}</p>
        <p>
          Assigned:{" "}
          {customer.assigned_user_name ||
            customer.assigned_username}
        </p>
      </div>

      <div className="customer-billing">
        <div className="billing-line">
          <span>Package</span>
          <strong>
            {formatMoney(customer.package_monthly_amount)}
          </strong>
        </div>
        <div className="billing-line">
          <span>Pending</span>
          <strong>
            {formatMoney(
              bill?.balance_amount ?? customer.overdue_amount ?? 0
            )}
          </strong>
        </div>
        {Number(bill?.arrears_amount || 0) > 0 && (
          <p className="billing-note">
            includes {formatMoney(bill.arrears_amount)} carried
            from an earlier month
          </p>
        )}
        <div className="billing-line">
          <span>Paid</span>
          <strong>{formatMoney(bill?.total_paid ?? 0)}</strong>
        </div>
        <div className="billing-line">
          <span>Status</span>
          <span className={status.className}>{status.text}</span>
        </div>
        <div className="billing-line billing-line--dates">
          <span>Payment dates</span>
          <strong>
            {paymentDates.length > 0
              ? paymentDates
                  .map(
                    (payment) =>
                      `${normalizeDate(payment.payment_date)} (${formatMoney(payment.collected_amount)})`
                  )
                  .join(", ")
              : "-"}
          </strong>
        </div>
      </div>

      <div className="customer-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onEdit(customer)}
        >
          <Pencil size={15} aria-hidden="true" />
          Edit
        </button>
        {canAdjust && bill && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onAdjust?.([customer])}
          >
            Edit due / overpaid
          </button>
        )}
        {billedThisMonth && bill ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onCollect(customer, bill, "bill")}
          >
            <IndianRupee size={15} aria-hidden="true" />
            Collect Payment
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onGenerateBill(customer)}
          >
            <ReceiptText size={15} aria-hidden="true" />
            Generate Bill
          </button>
        )}
      </div>
    </article>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const { version, notifyDataChanged } = useDataRefresh();
  const isAdmin = user?.role === "ADMIN";
  const [customers, setCustomers] = useState([]);
  const [billing, setBilling] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(FILTERS.ALL);
  const [placeFilter, setPlaceFilter] = useState("all");
  const [collectorUserId, setCollectorUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [adjustRows, setAdjustRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [customerData, billingData, paymentData] =
        await Promise.all([
          getCustomers(search, collectorUserId),
          getBilling(undefined, collectorUserId),
          getPayments({ collectorUserId }),
        ]);

      setCustomers(customerData);
      setBilling(billingData);
      setPayments(paymentData);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load customer data."
      );
    } finally {
      setLoading(false);
    }
  }, [search, collectorUserId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, loadData, version]);

  // The card shows the newest effective bill. It already carries earlier
  // dues and credits forward into a single "Due" amount.
  const billingByCustomer = useMemo(() => {
    const map = new Map();
    for (const record of billing) {
      if (record.is_effective === false) continue;
      const existing = map.get(record.customer_id);
      if (
        !existing ||
        String(record.billing_month) > String(existing.billing_month)
      ) {
        map.set(record.customer_id, record);
      }
    }
    return map;
  }, [billing]);

  const billedThisMonth = useMemo(() => {
    const month = getCurrentBillingMonth().slice(0, 7);
    const ids = new Set();
    for (const record of billing) {
      if (String(record.billing_month).slice(0, 7) === month) {
        ids.add(record.customer_id);
      }
    }
    return ids;
  }, [billing]);

  const paymentsByCustomer = useMemo(() => {
    const map = new Map();
    for (const payment of payments) {
      if (!payment.customer_id) continue;
      const existing = map.get(payment.customer_id) || [];
      existing.push(payment);
      map.set(payment.customer_id, existing);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.payment_date) - new Date(a.payment_date)
      );
    }
    return map;
  }, [payments]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const bill = billingByCustomer.get(customer.id);
      const customerPayments =
        paymentsByCustomer.get(customer.id) || [];

      if (!bill) {
        return (
          activeFilter === FILTERS.ALL ||
          activeFilter === FILTERS.MONTH
        );
      }

      switch (activeFilter) {
        case FILTERS.PAID:
          return bill.payment_status === "PAID";
        case FILTERS.OVERPAID:
          return bill.payment_status === "OVERPAID";
        case FILTERS.UNPAID:
          return bill.payment_status === "UNPAID";
        case FILTERS.PARTIAL:
          return bill.payment_status === "PARTIAL";
        case FILTERS.TODAY:
          return customerPayments.some(
            (payment) =>
              normalizeDate(payment.payment_date) === getToday()
          );
        case FILTERS.DATE:
          return customerPayments.some(
            (payment) =>
              normalizeDate(payment.payment_date) ===
              selectedDate
          );
        case FILTERS.MONTH:
        case FILTERS.ALL:
        default:
          return true;
      }
    });
  }, [
    customers,
    billingByCustomer,
    paymentsByCustomer,
    activeFilter,
    selectedDate,
  ]);

  const placeFilters = useMemo(() => {
    const map = new Map();
    for (const customer of customers) {
      const key = customer.place_id || "unassigned";
      if (!map.has(key)) {
        map.set(key, customer.place || "Unassigned");
      }
    }
    return [...map.entries()].sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [customers]);

  const placeFilteredCustomers = useMemo(() => {
    if (placeFilter === "all") return filteredCustomers;
    return filteredCustomers.filter(
      (customer) =>
        (customer.place_id || "unassigned") === placeFilter
    );
  }, [filteredCustomers, placeFilter]);

  const selectableVisibleIds = useMemo(
    () => placeFilteredCustomers.map((customer) => customer.id),
    [placeFilteredCustomers]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) =>
      selectedIds.has(id)
    );

  function toggleCustomerSelection(customerId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        for (const id of selectableVisibleIds) {
          next.delete(id);
        }
      } else {
        for (const id of selectableVisibleIds) {
          next.add(id);
        }
      }

      return next;
    });
  }

  const groupedCustomers = useMemo(
    () => groupCustomersByPlace(placeFilteredCustomers),
    [placeFilteredCustomers]
  );

  const groupedByUser = useMemo(() => {
    if (!isAdmin) return [];

    const map = new Map();
    for (const customer of placeFilteredCustomers) {
      const key = customer.assigned_user_id || "unassigned";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name:
            customer.assigned_user_name ||
            customer.assigned_username ||
            "Unassigned",
          customers: [],
        });
      }
      map.get(key).customers.push(customer);
    }

    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((userGroup) => ({
        ...userGroup,
        placeGroups: groupCustomersByPlace(userGroup.customers),
      }));
  }, [placeFilteredCustomers, isAdmin]);

  async function handleCreate(payload) {
    await createCustomer(payload);
    setSuccess("Customer created.");
    await loadData();
    notifyDataChanged();
  }

  async function handleUpdate(payload) {
    const updated = await updateCustomer(editingCustomer.id, payload);
    setSuccess(
      Number(updated?.repricedBills || 0) > 0
        ? `Customer updated. ${updated.repricedBills} outstanding bill(s) updated to the new package price.`
        : "Customer updated."
    );
    await loadData();
    notifyDataChanged();
  }

  function openAdjust(customersList) {
    const rows = customersList
      .map((customer) => {
        const bill = billingByCustomer.get(customer.id);
        if (!bill) return null;

        return {
          billingId: bill.billing_id || bill.id,
          customerId: customer.id,
          customerName: customer.customer_name,
          stbNumber: customer.stb_number,
          currentDue: Number(bill.balance_amount || 0),
          currentOverpaid: Number(bill.credit_available || 0),
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      setError("");
      setSuccess("");
      setAdjustRows(rows);
    }
  }

  async function handleAdjustSuccess(result) {
    const changed =
      result?.adjustments?.filter((item) => item.changed)
        .length || 0;
    setAdjustRows([]);
    setSuccess(
      changed > 0
        ? `${changed} bill(s) adjusted. Due and credit have been recalculated.`
        : "No changes were needed."
    );
    await loadData();
    notifyDataChanged();
  }

  async function handleGenerateBill(customer) {
    try {
      setError("");
      const result = await generateBilling({
        customerId: customer.id,
        billingMonth: getCurrentBillingMonth(),
      });
      const credit = Number(result?.creditApplied || 0);
      const creditMessage =
        credit > 0
          ? ` Previous credit of ${formatMoney(credit)} applied to this bill.`
          : "";
      setSuccess(
        `Billing generated for ${customer.customer_name}.${creditMessage}`
      );
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to generate billing."
      );
    }
  }

  async function handleGenerateBillBulk(ids) {
    if (ids.length === 0) return;

    setError("");
    setSuccess("");
    setBulkRunning(true);

    try {
      const result = await generateBillingBulk({
        customerIds: ids,
        billingMonth: getCurrentBillingMonth(),
      });
      const generated = result.generated?.length ?? 0;
      const skippedItems = result.skipped ?? [];
      const failed = result.failed ?? [];
      const parts = [
        `Generated ${generated} bill${generated === 1 ? "" : "s"}`,
      ];

      if (skippedItems.length > 0) {
        parts.push(`skipped ${skippedItems.length} already billed`);
      }

      const creditItems = (result.generated ?? []).filter(
        (item) => Number(item?.creditApplied || 0) > 0
      );
      const creditNote =
        creditItems.length > 0
          ? ` Credits applied: ${creditItems
              .map(
                (item) =>
                  `${item.customerName} (${formatMoney(
                    item.creditApplied
                  )})`
              )
              .join(", ")}.`
          : "";

      setSuccess(`${parts.join(", ")}.${creditNote}`);

      if (failed.length > 0) {
        setError(
          `Could not generate billing for: ${failed
            .map((item) => item.message)
            .join(" ")}`
        );
      }

      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to generate billing."
      );
    } finally {
      setBulkRunning(false);
    }
  }

  async function saveOrder(reordered) {
    const indexed = reordered.map((item, index) => ({
      ...item,
      display_order: index,
    }));
    const orderedIds = indexed.map((item) => item.id);
    const groupIds = new Set(orderedIds);
    const previousCustomers = customers;

    // Optimistically reorder in local state so the list updates
    // without refetching billing/payments.
    setCustomers((prev) => {
      let cursor = 0;
      return prev.map((item) =>
        groupIds.has(item.id) ? indexed[cursor++] : item
      );
    });

    try {
      await reorderCustomers(orderedIds);
    } catch (err) {
      setCustomers(previousCustomers);
      setError(
        err.response?.data?.error?.message ||
          "Unable to update order."
      );
    }
  }

  async function moveCustomer(group, customerId, direction) {
    if (isAdmin) return;

    const index = group.customers.findIndex(
      (item) => item.id === customerId
    );
    const target = index + direction;
    if (index < 0 || target >= group.customers.length || target < 0) {
      return;
    }

    await saveOrder(arrayMove(group.customers, index, target));
  }

  async function handleDragEnd(group, event) {
    if (isAdmin) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = group.customers.findIndex(
      (item) => item.id === active.id
    );
    const newIndex = group.customers.findIndex(
      (item) => item.id === over.id
    );
    if (oldIndex < 0 || newIndex < 0) return;

    await saveOrder(arrayMove(group.customers, oldIndex, newIndex));
  }

  function renderPlaceGroup(group) {
    return (
      <div className="place-group" key={group.id}>
        <div className="place-group-header">
          <h2>
            <span className="place-dot" aria-hidden="true" />
            {group.name}
          </h2>
          <span className="count-chip">
            {group.customers.length} customers
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(group, event)}
        >
          <SortableContext
            items={group.customers.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="customer-list">
              {group.customers.map((customer, index) => {
                const bill = billingByCustomer.get(customer.id);

                return (
                  <SortableCustomerCard
                    key={customer.id}
                    customer={customer}
                    bill={bill}
                    paymentDates={
                      paymentsByCustomer.get(customer.id) || []
                    }
                    billedThisMonth={billedThisMonth.has(customer.id)}
                    serial={index + 1}
                    selected={selectedIds.has(customer.id)}
                    onToggleSelect={toggleCustomerSelection}
                    dragDisabled={isAdmin}
                    isFirst={index === 0}
                    isLast={index === group.customers.length - 1}
                    onMoveUp={() =>
                      moveCustomer(group, customer.id, -1)
                    }
                    onMoveDown={() =>
                      moveCustomer(group, customer.id, 1)
                    }
                    onEdit={(item) => {
                      setFormMode("edit");
                      setEditingCustomer(item);
                      setFormOpen(true);
                    }}
                    onCollect={(item, billRow, mode) =>
                      setPaymentTarget({
                        customer: item,
                        bill: billRow,
                        mode: mode || "bill",
                      })
                    }
                    onGenerateBill={handleGenerateBill}
                    onAdjust={openAdjust}
                    canAdjust={isAdmin}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return (
    <section className="page page--customers customers-page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>
            {isAdmin
              ? "Read-only view of each collector's saved order."
              : "Search, bill, collect, and reorder your customers."}
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormMode("create");
                setEditingCustomer(null);
                setFormOpen(true);
              }}
            >
              <Plus size={17} aria-hidden="true" />
              Add customer
            </button>
          </div>
        )}
      </div>

      {success && <p className="success-toast">{success}</p>}

      <div className="toolbar toolbar--glass">
        <label className="field search-field">
          <span>Search</span>
          <div className="input-with-icon">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              className="search-input"
              placeholder="Search name, STB, phone or place..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </label>

        <label className="field place-filter">
          <span>Place</span>
          <select
            className="select"
            value={placeFilter}
            onChange={(event) =>
              setPlaceFilter(event.target.value)
            }
          >
            <option value="all">All places</option>
            {placeFilters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <CollectorFilter
          value={collectorUserId}
          onChange={setCollectorUserId}
        />

        <div className="filter-row">
          {[
            [FILTERS.ALL, "All"],
            [FILTERS.PAID, "Paid"],
            [FILTERS.OVERPAID, "Overpaid"],
            [FILTERS.PARTIAL, "Partial"],
            [FILTERS.UNPAID, "Unpaid"],
            [FILTERS.TODAY, "Today's Payments"],
            [FILTERS.MONTH, "This Month"],
            [FILTERS.DATE, "Paid by Date"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                activeFilter === value
                  ? "filter-button active"
                  : "filter-button"
              }
              onClick={() => setActiveFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeFilter === FILTERS.DATE && (
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(event.target.value)
            }
          />
        )}
      </div>

      {!loading && placeFilteredCustomers.length > 0 && (
        <div
          className="billing-bulk-bar"
          aria-label="Billing actions"
        >
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={selectableVisibleIds.length === 0}
              onChange={toggleSelectAllVisible}
              aria-label="Select all visible customers"
            />
            <span>Select all</span>
          </label>

          <div className="billing-bulk-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={bulkRunning || selectedIds.size === 0}
              onClick={() =>
                handleGenerateBillBulk([...selectedIds])
              }
            >
              <ReceiptText size={16} aria-hidden="true" />
              {bulkRunning
                ? "Generating..."
                : `Generate bill (${selectedIds.size})`}
            </button>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={selectedIds.size === 0}
                onClick={() =>
                  openAdjust(
                    [...selectedIds]
                      .map((id) =>
                        customers.find(
                          (item) => item.id === id
                        )
                      )
                      .filter(Boolean)
                  )
                }
              >
                Edit due / overpaid ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <p className="muted">Loading customers...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && placeFilteredCustomers.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-orb" aria-hidden="true">
            <Users size={22} />
          </span>
          <strong>No customers found</strong>
          <p>Try a different search, place, or filter.</p>
        </div>
      )}

      {!loading &&
        placeFilteredCustomers.length > 0 &&
        !isAdmin && (
          <div className="place-groups">
            {groupedCustomers.map((group) =>
              renderPlaceGroup(group)
            )}
          </div>
        )}

      {!loading &&
        placeFilteredCustomers.length > 0 &&
        isAdmin && (
          <div className="user-groups">
            {groupedByUser.map((userGroup) => (
              <section
                className="user-group"
                key={userGroup.id}
                aria-label={`Customers for ${userGroup.name}`}
              >
                <div className="place-group-header user-group-header">
                  <h2>
                    <Users size={16} aria-hidden="true" />
                    {userGroup.name}
                  </h2>
                  <span className="count-chip">
                    {userGroup.customers.length} customers
                  </span>
                </div>
                <div className="user-group-body">
                  {userGroup.placeGroups.map((group) =>
                    renderPlaceGroup(group)
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

      {formOpen && (
        <CustomerFormModal
          mode={formMode}
          initialCustomer={editingCustomer}
          onClose={() => {
            setFormOpen(false);
            setEditingCustomer(null);
          }}
          onSubmit={
            formMode === "create" ? handleCreate : handleUpdate
          }
        />
      )}

      {paymentTarget && (
        <CollectPaymentModal
          open
          mode={paymentTarget.mode}
          customer={paymentTarget.customer}
          bill={paymentTarget.bill}
          onClose={() => setPaymentTarget(null)}
          onSuccess={async () => {
            setSuccess(
              paymentTarget.mode === "arrears"
                ? "Arrears payment recorded."
                : "Payment recorded."
            );
            await loadData();
          }}
        />
      )}

      {adjustRows.length > 0 && (
        <AdjustBillsModal
          open
          rows={adjustRows}
          onClose={() => setAdjustRows([])}
          onSuccess={handleAdjustSuccess}
        />
      )}
    </section>
  );
}
