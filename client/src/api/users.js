import apiClient from "./client";

export async function getUsers() {
  const response = await apiClient.get("/users");
  return response.data.data.users;
}

export async function createUser({
  username,
  fullName,
  password,
}) {
  const response = await apiClient.post("/users", {
    username,
    fullName,
    password,
  });
  return response.data.data.user;
}

export async function activateUser(userId) {
  const response = await apiClient.patch(
    `/users/${userId}/activate`
  );
  return response.data.data.user;
}

export async function deactivateUser(userId) {
  const response = await apiClient.patch(
    `/users/${userId}/deactivate`
  );
  return response.data.data.user;
}
