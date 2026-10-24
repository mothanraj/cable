import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let accessToken = null;
let refreshPromise = null;
let onSessionRefreshed = null;
let onAuthFailure = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function setOnSessionRefreshed(callback) {
  onSessionRefreshed = callback;
}

export function setOnAuthFailure(callback) {
  onAuthFailure = callback;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization =
      `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = apiClient
          .post("/auth/refresh")
          .then((response) => {
            const data = response.data.data;

            setAccessToken(data.accessToken);

            if (typeof onSessionRefreshed === "function") {
              onSessionRefreshed(data);
            }

            return data.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;

      originalRequest.headers.Authorization =
        `Bearer ${newToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);

      if (typeof onAuthFailure === "function") {
        onAuthFailure();
      }

      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
