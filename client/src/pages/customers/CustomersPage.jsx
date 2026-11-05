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
import CollectPaymentModal from "../../components/CollectPaymentModal";
import CustomerFormModal from "../../components/CustomerFormModal";
import { useAuth } from "../../context/AuthContext";
import {
  formatMoney,
  getCurrentBillingMonth,
  getToday,
  normalizeDate,
  statusClass,
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
  latestPayment,
  serial,
  onEdit,
  onCollect,
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

      <label
        className="card-checkbox"
        title="Select customer"
      >
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
        {bill ? (
          <>
            <div className="billing-line">
              <span>Package</span>
              <strong>{formatMoney(bill.monthly_amount)}</strong>
            </div>
            <div className="billing-line">
              <span>Arrears</span>
              <strong>
                {formatMoney(Number(bill.arrears_amount || 0))}
              </strong>
            </div>
            <div className="billing-line">
              <span>Due</span>
              <strong>
                {formatMoney(
                  Number(
                    bill.due_amount ??
                      Number(bill.monthly_amount || 0) +
                        Number(bill.arrears_amount || 0)
                  )
                )}
              </strong>
            </div>
            <div className="billing-line">
              <span>Paid</span>
              <strong>{formatMoney(bill.total_paid)}</strong>
            </div>
            <div className="billing-line">
              <span>Balance</span>
              <strong>{formatMoney(bill.balance_amount)}</strong>
            </div>
            <div className="billing-line">
              <span>Status</span>
              <span className={statusClass(bill.payment_status)}>
                {bill.payment_status}
              </span>
            </div>
            <div className="billing-line">
              <span>Latest payment</span>
              <strong>
                {latestPayment
                  ? normalizeDate(latestPayment.payment_date)
                  : "-"}
              </strong>
            </div>
          </>
        ) : (
          <p className="muted">No billing for this month.</p>
        )}
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
        {bill ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onCollect(customer, bill)}
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
  const isAdmin = user?.role === "ADMIN";
  const [customers, setCustomers] = useState([]);
  const [billing, setBilling] = useState([]);
  const [paymentsByBilling, setPaymentsByBilling] = useState(
    new Map()
  );
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(FILTERS.ALL);
  const [placeFilter, setPlaceFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
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
          getCustomers(search),
          getBilling(getCurrentBillingMonth()),
          getPayments(),
        ]);

      setCustomers(customerData);
      setBilling(billingData);

      const paymentMap = new Map();
      for (const payment of paymentData) {
        const existing =
          paymentMap.get(payment.billing_id) || [];
        existing.push(payment);
        paymentMap.set(payment.billing_id, existing);
      }
      setPaymentsByBilling(paymentMap);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load customer data."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, loadData]);

  const billingByCustomer = useMemo(() => {
    const map = new Map();
    for (const record of billing) {
      map.set(record.customer_id, record);
    }
    return map;
  }, [billing]);

  const customerPaymentInfo = useMemo(() => {
    const map = new Map();
    for (const bill of billing) {
      const payments =
        paymentsByBilling.get(bill.billing_id || bill.id) ||
        [];
      const latestPayment =
        [...payments].sort(
          (a, b) =>
            new Date(b.payment_date) - new Date(a.payment_date)
        )[0] || null;
      map.set(bill.customer_id, { payments, latestPayment });
    }
    return map;
  }, [billing, paymentsByBilling]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const bill = billingByCustomer.get(customer.id);
      const paymentInfo = customerPaymentInfo.get(customer.id);
      const payments = paymentInfo?.payments || [];

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
          return payments.some(
            (payment) =>
              normalizeDate(payment.payment_date) === getToday()
          );
        case FILTERS.DATE:
          return payments.some(
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
    customerPaymentInfo,
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

  const visibleCustomerIds = useMemo(
    () =>
      placeFilteredCustomers.map(
        (customer) => customer.id
      ),
    [placeFilteredCustomers]
  );

  const allVisibleSelected =
    visibleCustomerIds.length > 0 &&
    visibleCustomerIds.every((id) =>
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
        for (const id of visibleCustomerIds) {
          next.delete(id);
        }
      } else {
        for (const id of visibleCustomerIds) {
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
  }

  async function handleUpdate(payload) {
    await updateCustomer(editingCustomer.id, payload);
    setSuccess("Customer updated.");
    await loadData();
  }

  async function handleGenerateBill(customer) {
    try {
      setError("");
      const result = await generateBilling({
        customerId: customer.id,
        billingMonth: getCurrentBillingMonth(),
      });
      const overpaid = result?.previousOverpaid;
      const overpaidMessage =
        Number(overpaid?.amount || 0) > 0
          ? ` Overpaid balance from previous bills: ${formatMoney(overpaid.amount)}.`
          : "";
      setSuccess(
        `Billing generated for ${customer.customer_name}.${overpaidMessage}`
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
      const skipped = result.skipped?.length ?? 0;
      const failed = result.failed ?? [];

      const parts = [
        `Generated ${generated} bill${generated === 1 ? "" : "s"}`,
        `skipped ${skipped} already billed`,
      ];

      const overpaidItems = (result.generated ?? []).filter(
        (item) => Number(item?.previousOverpaid?.amount || 0) > 0
      );
      const overpaidNote =
        overpaidItems.length > 0
          ? ` Overpaid balances: ${overpaidItems
              .map(
                (item) =>
                  `${item.customerName} (${formatMoney(
                    item.previousOverpaid.amount
                  )})`
              )
              .join(", ")}.`
          : "";

      setSuccess(`${parts.join(", ")}.${overpaidNote}`);

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
                const paymentInfo = customerPaymentInfo.get(
                  customer.id
                );

                return (
                  <SortableCustomerCard
                    key={customer.id}
                    customer={customer}
                    bill={bill}
                    serial={index + 1}
                    latestPayment={paymentInfo?.latestPayment}
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
                    onCollect={(item, billRow) =>
                      setPaymentTarget({
                        customer: item,
                        bill: billRow,
                      })
                    }
                    onGenerateBill={handleGenerateBill}
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

      <CollectPaymentModal
        open={Boolean(paymentTarget)}
        customer={paymentTarget?.customer}
        bill={paymentTarget?.bill}
        onClose={() => setPaymentTarget(null)}
        onSuccess={async () => {
          setSuccess("Payment recorded.");
          await loadData();
        }}
      />
    </section>
  );
}
