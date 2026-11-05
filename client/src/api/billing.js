import apiClient from "./client";

export async function getBilling(billingMonth) {
  const response = await apiClient.get("/billing", {
    params: billingMonth ? { billingMonth } : {},
  });
  return response.data.data.billing;
}

export async function generateBilling({
  customerId,
  billingMonth,
}) {
  const response = await apiClient.post("/billing/generate", {
    customerId,
    billingMonth,
  });
  return response.data.data;
}

export async function generateBillingBulk({
  customerIds,
  billingMonth,
}) {
  const response = await apiClient.post(
    "/billing/generate-bulk",
    {
      customerIds,
      billingMonth,
    }
  );
  return response.data.data;
}
