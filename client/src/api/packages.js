import apiClient from "./client";

export async function getPackages() {
  const response = await apiClient.get("/packages");
  return response.data.data.packages;
}

export async function getPackageById(packageId) {
  const response = await apiClient.get(
    `/packages/${packageId}`
  );
  return response.data.data.package;
}
