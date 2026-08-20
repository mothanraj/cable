import apiClient from "./client";

export async function getCustomers(search = "") {
  const response = await apiClient.get(
    "/customers",
    {
      params: search.trim()
        ? { search: search.trim() }
        : {},
    }
  );

  return response.data.data.customers;
}

export async function getCustomerById(
  customerId
) {
  const response = await apiClient.get(
    `/customers/${customerId}`
  );

  return response.data.data.customer;
}