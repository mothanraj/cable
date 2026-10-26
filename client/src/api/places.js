import apiClient from "./client";

export async function getPlaces({ includeInactive = false } = {}) {
  const response = await apiClient.get("/places", {
    params: includeInactive ? { includeInactive: true } : {},
  });
  return response.data.data.places;
}

export async function createPlace({ placeName }) {
  const response = await apiClient.post("/places", {
    placeName,
  });
  return response.data.data.place;
}

export async function updatePlace(placeId, { placeName }) {
  const response = await apiClient.patch(`/places/${placeId}`, {
    placeName,
  });
  return response.data.data.place;
}

export async function activatePlace(placeId) {
  const response = await apiClient.patch(
    `/places/${placeId}/activate`
  );
  return response.data.data.place;
}

export async function deactivatePlace(placeId) {
  const response = await apiClient.patch(
    `/places/${placeId}/deactivate`
  );
  return response.data.data.place;
}
