import apiClient from "./client";

export async function createPayment({
  billingId,
  paymentDate,
  collectedAmount,
  remarks,
}) {
  const response = await apiClient.post(
    "/payments",
    {
      billingId,
      paymentDate,
      collectedAmount,
      remarks,
    }
  );

  return response.data.data.payment;
}

export async function getPayments(billingId) {
  const response = await apiClient.get(
    "/payments",
    {
      params: billingId
        ? { billingId }
        : {},
    }
  );

  return response.data.data.payments;
}