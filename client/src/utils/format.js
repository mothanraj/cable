export function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthRange(offset = 0) {
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

export function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getCurrentBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function normalizeDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

export function formatMoney(value) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function getOverpaidAmount(row) {
  if (row.credit_available !== undefined) {
    return Math.max(Number(row.credit_available || 0), 0);
  }
  return Math.max(
    Number(row.total_paid || 0) -
      Number(row.due_amount ?? row.monthly_amount ?? 0),
    0
  );
}

export function statusClass(status) {
  if (status === "OVERPAID") return "status-pill status-overpaid";
  if (status === "PAID") return "status-pill status-paid";
  if (status === "PARTIAL") return "status-pill status-partial";
  if (status === "UNPAID") return "status-pill status-unpaid";
  return "status-pill status-unpaid";
}

export function connectionClass(isActive) {
  return isActive
    ? "status-pill status-active"
    : "status-pill status-deactive";
}

// One badge that describes both the connection and the payment state, so
// "ACTIVE" and "PARTIAL" never appear as two competing pills.
export function combinedStatus(bill, isActive) {
  const connection = isActive ? "ACTIVE" : "DEACTIVE";
  const balance = Number(bill?.balance_amount || 0);
  const credit = Number(bill?.credit_available || 0);

  if (!bill) {
    return {
      text: connection,
      className: connectionClass(isActive),
    };
  }

  if (balance > 0) {
    return {
      text: `${connection} · ${formatMoney(balance)} due`,
      className: isActive
        ? "status-pill status-partial"
        : "status-pill status-deactive",
    };
  }

  if (credit > 0) {
    return {
      text: `${connection} · OVERPAID ${formatMoney(credit)}`,
      className: "status-pill status-overpaid",
    };
  }

  return {
    text: `${connection} · PAID`,
    className: isActive
      ? "status-pill status-paid"
      : "status-pill status-deactive",
  };
}
