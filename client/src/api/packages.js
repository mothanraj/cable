import apiClient from "./client";

export async function getPackages({
  includeInactive = false,
} = {}) {
  const response = await apiClient.get("/packages", {
    params: includeInactive ? { includeInactive: true } : {},
  });
  return response.data.data.packages;
}

export async function getPackageById(packageId) {
  const response = await apiClient.get(
    `/packages/${packageId}`
  );
  return response.data.data.package;
}

export async function createPackage({
  packageName,
  monthlyAmount,
}) {
  const response = await apiClient.post("/packages", {
    packageName,
    monthlyAmount,
  });
  return response.data.data.package;
}

export async function updatePackage(
  packageId,
  { packageName, monthlyAmount }
) {
  const response = await apiClient.patch(
    `/packages/${packageId}`,
    {
      packageName,
      monthlyAmount,
    }
  );
  return response.data.data.package;
}

export async function setDefaultPackage(packageId) {
  const response = await apiClient.patch(
    `/packages/${packageId}/default`
  );
  return response.data.data.package;
}

export async function activatePackage(packageId) {
  const response = await apiClient.patch(
    `/packages/${packageId}/activate`
  );
  return response.data.data.package;
}

export async function deactivatePackage(packageId) {
  const response = await apiClient.patch(
    `/packages/${packageId}/deactivate`
  );
  return response.data.data.package;
}
