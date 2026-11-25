import apiClient from "./client";

export async function getDashboard(billingMonth, collectorUserId) {
  const params = {};

  if (billingMonth) {
    params.billingMonth = billingMonth;
  }

  if (collectorUserId) {
    params.collectorUserId = collectorUserId;
  }

  const response = await apiClient.get("/dashboard", { params });
  return response.data.data;
}
