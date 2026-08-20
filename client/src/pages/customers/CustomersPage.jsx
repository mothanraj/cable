import { useEffect, useMemo, useState } from "react";
import { getCustomers } from "../../api/customers";
import { getBilling } from "../../api/billing";
import { getPayments } from "../../api/payments";

const FILTERS = {
  ALL: "all",
  PAID: "paid",
  UNPAID: "unpaid",
  TODAY: "today",
  MONTH: "month",
  DATE: "date",
};

function getToday() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [billing, setBilling] = useState([]);
  const [paymentsByBilling, setPaymentsByBilling] =
    useState(new Map());

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState(FILTERS.ALL);

  const [selectedDate, setSelectedDate] =
    useState(getToday());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
  customerData,
  billingData,
  paymentData,
] = await Promise.all([
  getCustomers(search),
  getBilling(getCurrentMonth()),
  getPayments(),
]);

setCustomers(customerData);
setBilling(billingData);

const paymentMap = new Map();

for (const payment of paymentData) {
  const existing =
    paymentMap.get(payment.billing_id) || [];

  existing.push(payment);

  paymentMap.set(
    payment.billing_id,
    existing
  );
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
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const billingByCustomer = useMemo(() => {
    const map = new Map();

    for (const record of billing) {
      map.set(record.customer_id, record);
    }

    return map;
  }, [billing]);

  const customerPaymentInfo =
    useMemo(() => {
      const map = new Map();

      for (const bill of billing) {
        const payments =
          paymentsByBilling.get(
            bill.billing_id
          ) || [];

        const latestPayment =
          [...payments]
            .sort(
              (a, b) =>
                new Date(b.payment_date) -
                new Date(a.payment_date)
            )[0] || null;

        map.set(bill.customer_id, {
          payments,
          latestPayment,
        });
      }

      return map;
    }, [
      billing,
      paymentsByBilling,
    ]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const bill =
        billingByCustomer.get(customer.id);

      if (!bill) {
        return activeFilter === FILTERS.ALL;
      }

      const paymentInfo =
        customerPaymentInfo.get(customer.id);

      const payments =
        paymentInfo?.payments || [];

      switch (activeFilter) {
        case FILTERS.PAID:
          return bill.payment_status === "PAID";

        case FILTERS.UNPAID:
          return bill.payment_status === "UNPAID";

        case FILTERS.TODAY:
          return payments.some(
            (payment) =>
              normalizeDate(
                payment.payment_date
              ) === getToday()
          );

        case FILTERS.MONTH:
          return true;

        case FILTERS.DATE:
          return payments.some(
            (payment) =>
              normalizeDate(
                payment.payment_date
              ) === selectedDate
          );

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

  return (
    <section className="customers-page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>

          <p>
            Manage customers, billing and
            payments.
          </p>
        </div>
      </div>

      <div className="customer-toolbar">
        <input
          type="search"
          placeholder="Search name, STB, phone or place..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          className="customer-search"
        />

        <div className="customer-filters">
          {[
            [FILTERS.ALL, "All"],
            [FILTERS.PAID, "Paid"],
            [FILTERS.UNPAID, "Unpaid"],
            [
              FILTERS.TODAY,
              "Today's Payments",
            ],
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
              onClick={() =>
                setActiveFilter(value)
              }
            >
              {label}
            </button>
          ))}
        </div>

        {activeFilter === FILTERS.DATE && (
          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
            className="date-filter"
          />
        )}
      </div>

      {loading && (
        <p>Loading customers...</p>
      )}

      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      {!loading &&
        !error &&
        filteredCustomers.length === 0 && (
          <p>No customers found.</p>
        )}

      {!loading &&
        !error &&
        filteredCustomers.length > 0 && (
          <div className="customer-list">
            {filteredCustomers.map(
              (customer) => {
                const bill =
                  billingByCustomer.get(
                    customer.id
                  );

                const paymentInfo =
                  customerPaymentInfo.get(
                    customer.id
                  );

                const latestPayment =
                  paymentInfo?.latestPayment;

                return (
                  <article
                    key={customer.id}
                    className="customer-card"
                  >
                    <div>
                      <h2>
                        {customer.customer_name}
                      </h2>

                      <p>
                        STB:{" "}
                        {customer.stb_number}
                      </p>

                      <p>
                        Phone:{" "}
                        {customer.phone || "-"}
                      </p>

                      <p>
                        Place:{" "}
                        {customer.place || "-"}
                      </p>

                      <p>
                        Package:{" "}
                        {customer.package_name}
                      </p>

                      <p>
                        Assigned:{" "}
                        {
                          customer.assigned_username
                        }
                      </p>
                    </div>

                    {bill && (
                      <div>
                        <p>
                          Monthly: ₹
                          {
                            bill.monthly_amount
                          }
                        </p>

                        <p>
                          Paid: ₹
                          {bill.total_paid}
                        </p>

                        <p>
                          Balance: ₹
                          {
                            bill.balance_amount
                          }
                        </p>

                        <p>
                          Status:{" "}
                          <strong>
                            {
                              bill.payment_status
                            }
                          </strong>
                        </p>

                        <p>
                          Latest payment:{" "}
                          {latestPayment
                            ? normalizeDate(
                                latestPayment.payment_date
                              )
                            : "-"}
                        </p>
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
    </section>
  );
}