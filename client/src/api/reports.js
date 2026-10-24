import apiClient from "./client";

export async function getBillingReport(billingMonth) {
  const response = await apiClient.get("/reports/billing", {
    params: billingMonth ? { billingMonth } : {},
  });
  return response.data.data.billing;
}
