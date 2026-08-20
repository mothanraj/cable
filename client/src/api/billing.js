import apiClient from "./client";

export async function getBilling(
  billingMonth
) {
  const response = await apiClient.get(
    "/billing",
    {
      params: billingMonth
        ? { billingMonth }
        : {},
    }
  );

  return response.data.data.billing;
}