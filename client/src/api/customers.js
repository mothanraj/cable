import apiClient from "./client";

export async function getCustomers(search = "") {
  const response = await apiClient.get("/customers", {
    params: search.trim() ? { search: search.trim() } : {},
  });
  return response.data.data.customers;
}

export async function getCustomerById(customerId) {
  const response = await apiClient.get(
    `/customers/${customerId}`
  );
  return response.data.data.customer;
}

export async function createCustomer(payload) {
  const response = await apiClient.post("/customers", payload);
  return response.data.data.customer;
}

export async function updateCustomer(customerId, payload) {
  const response = await apiClient.patch(
    `/customers/${customerId}`,
    payload
  );
  return response.data.data.customer;
}

export async function deactivateCustomer(customerId) {
  const response = await apiClient.patch(
    `/customers/${customerId}/deactivate`
  );
  return response.data.data.customer;
}

export async function updateCustomerOrder(
  customerId,
  displayOrder
) {
  const response = await apiClient.patch(
    `/customers/${customerId}/order`,
    { displayOrder }
  );
  return response.data.data.customer;
}

export async function assignCustomer(
  customerId,
  assignedUserId
) {
  const response = await apiClient.patch(
    `/customers/${customerId}/assign`,
    { assignedUserId }
  );
  return response.data.data.customer;
}
