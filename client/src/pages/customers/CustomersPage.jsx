import { useEffect, useMemo, useState } from "react";
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
import { GripVertical } from "lucide-react";
import { generateBilling, getBilling } from "../../api/billing";
import {
  createCustomer,
  getCustomers,
  updateCustomer,
  updateCustomerOrder,
} from "../../api/customers";
import { getPayments } from "../../api/payments";
import CollectPaymentModal from "../../components/CollectPaymentModal";
import CustomerFormModal from "../../components/CustomerFormModal";
import {
  formatMoney,
  getCurrentBillingMonth,
  getToday,
  normalizeDate,
  statusClass,
} from "../../utils/format";

const FILTERS = {
  ALL: "all",
  PAID: "paid",
  UNPAID: "unpaid",
  PARTIAL: "partial",
  TODAY: "today",
  MONTH: "month",
  DATE: "date",
};

function SortableCustomerCard({
  customer,
  bill,
  latestPayment,
  onEdit,
  onCollect,
  onGenerateBill,
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
      className={`customer-card ${isDragging ? "dragging" : ""}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="Reorder customer"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>

      <div className="customer-meta">
        <h2>{customer.customer_name}</h2>
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
            <p>Monthly: {formatMoney(bill.monthly_amount)}</p>
            <p>Paid: {formatMoney(bill.total_paid)}</p>
            <p>Balance: {formatMoney(bill.balance_amount)}</p>
            <p>
              <span className={statusClass(bill.payment_status)}>
                {bill.payment_status}
              </span>
            </p>
            <p>
              Latest payment:{" "}
              {latestPayment
                ? normalizeDate(latestPayment.payment_date)
                : "-"}
            </p>
          </>
        ) : (
          <p className="muted">No billing for this month.</p>
        )}

        <div className="customer-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onEdit(customer)}
          >
            Edit
          </button>
          {bill ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onCollect(customer, bill)}
            >
              Collect Payment
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onGenerateBill(customer)}
            >
              Generate Bill
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [billing, setBilling] = useState([]);
  const [paymentsByBilling, setPaymentsByBilling] = useState(
    new Map()
  );
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(FILTERS.ALL);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  async function loadData() {
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
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

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
      await generateBilling({
        customerId: customer.id,
        billingMonth: getCurrentBillingMonth(),
      });
      setSuccess(`Billing generated for ${customer.customer_name}.`);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to generate billing."
      );
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = customers.findIndex(
      (item) => item.id === active.id
    );
    const newIndex = customers.findIndex(
      (item) => item.id === over.id
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = customers;
    const reordered = arrayMove(customers, oldIndex, newIndex);
    setCustomers(reordered);

    try {
      await updateCustomerOrder(active.id, newIndex);
      await loadData();
    } catch (err) {
      setCustomers(previous);
      setError(
        err.response?.data?.error?.message ||
          "Unable to update order."
      );
    }
  }

  return (
    <section className="customers-page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Search, bill, collect, and reorder assigned customers.</p>
        </div>
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
            Add customer
          </button>
        </div>
      </div>

      {success && <p className="success-toast">{success}</p>}

      <div className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search name, STB, phone or place..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="filter-row">
          {[
            [FILTERS.ALL, "All"],
            [FILTERS.PAID, "Paid"],
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

      {loading && <p className="muted">Loading customers...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && filteredCustomers.length === 0 && (
        <p className="empty-state">No customers found.</p>
      )}

      {!loading && filteredCustomers.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredCustomers.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="customer-list">
              {filteredCustomers.map((customer) => {
                const bill = billingByCustomer.get(customer.id);
                const paymentInfo = customerPaymentInfo.get(
                  customer.id
                );

                return (
                  <SortableCustomerCard
                    key={customer.id}
                    customer={customer}
                    bill={bill}
                    latestPayment={paymentInfo?.latestPayment}
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
      )}

      <CustomerFormModal
        open={formOpen}
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
