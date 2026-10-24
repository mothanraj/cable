export function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getCurrentBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function normalizeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export function formatMoney(value) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function statusClass(status) {
  if (status === "PAID") return "status-pill status-paid";
  if (status === "PARTIAL") return "status-pill status-partial";
  return "status-pill status-unpaid";
}
