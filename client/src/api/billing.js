import apiClient from "./client";

export async function getBilling(billingMonth, collectorUserId) {
  const params = {};

  if (billingMonth) {
    params.billingMonth = billingMonth;
  }

  if (collectorUserId) {
    params.collectorUserId = collectorUserId;
  }

  const response = await apiClient.get("/billing", { params });
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

export async function adjustBills({ entries, reason }) {
  const response = await apiClient.patch("/billing/adjust", {
    entries,
    reason: reason || null,
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
