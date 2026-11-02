import apiClient from "./client";

export async function getBillingReport(filters = {}) {
  const normalized =
    typeof filters === "string"
      ? { billingMonth: filters }
      : filters;

  const params = {};

  if (normalized.billingMonth) {
    params.billingMonth = normalized.billingMonth;
  }

  if (normalized.from) {
    params.from = normalized.from;
  }

  if (normalized.to) {
    params.to = normalized.to;
  }

  const response = await apiClient.get("/reports/billing", {
    params,
  });

  return response.data.data.billing;
}
