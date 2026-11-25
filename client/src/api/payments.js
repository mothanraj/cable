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

export async function payArrears({
  customerId,
  amount,
  paymentDate,
  remarks,
}) {
  const response = await apiClient.post("/payments/arrears", {
    customerId,
    amount,
    paymentDate,
    remarks,
  });

  return response.data.data;
}

export async function updatePaymentAmount(
  paymentId,
  { collectedAmount, reason }
) {
  const response = await apiClient.patch(
    `/payments/${paymentId}/amount`,
    {
      collectedAmount,
      reason: reason || null,
    }
  );

  return response.data.data;
}

export async function getPayments({ billingId, collectorUserId } = {}) {
  const params = {};

  if (billingId) {
    params.billingId = billingId;
  }

  if (collectorUserId) {
    params.collectorUserId = collectorUserId;
  }

  const response = await apiClient.get("/payments", { params });

  return response.data.data.payments;
}