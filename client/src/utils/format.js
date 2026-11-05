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
