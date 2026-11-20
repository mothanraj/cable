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

export async function getCustomersReport(filters = {}) {
  const params = {};

  if (filters.search) {
    params.search = filters.search;
  }
  if (filters.placeId && filters.placeId !== "all") {
    params.placeId = filters.placeId;
  }
  if (filters.packageId && filters.packageId !== "all") {
    params.packageId = filters.packageId;
  }
  if (filters.includeInactive === false) {
    params.includeInactive = false;
  }

  const response = await apiClient.get("/customers/report", {
    params,
  });

  return response.data.data.customers;
}
