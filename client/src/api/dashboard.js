import apiClient from "./client";

export async function getDashboard(billingMonth) {
  const response = await apiClient.get("/dashboard", {
    params: billingMonth ? { billingMonth } : {},
  });
  return response.data.data;
}
