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

export function isSessionInvalidError(error) {
  return (
    error.response?.status === 401 &&
    error.response?.data?.error?.code ===
      "INVALID_SESSION"
  );
}

// One shared refresh path for startup, the 401 interceptor and the idle
// monitor. Concurrent callers all await the same in-flight request, which
// matters because refresh tokens are single-use and rotate on every call.
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh")
      .then((response) => {
        const data = response.data.data;

        setAccessToken(data.accessToken);

        if (typeof onSessionRefreshed === "function") {
          onSessionRefreshed(data);
        }

        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

// Startup refresh: tolerate transient API/database failures before giving up.
export async function refreshAccessTokenWithRetry(attempts = 3) {
  let lastError;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await refreshAccessToken();
    } catch (error) {
      lastError = error;

      if (isSessionInvalidError(error)) {
        throw error;
      }

      if (index < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (index + 1))
        );
      }
    }
  }

  throw lastError;
}

export async function pingActivity() {
  try {
    return await apiClient.post("/auth/activity");
  } catch (error) {
    // An expired access token is not an expired session. Refresh once and
    // retry so an active user is never timed out by a stale token.
    if (
      error.response?.status === 401 &&
      error.response?.data?.error?.code ===
        "INVALID_OR_EXPIRED_TOKEN"
    ) {
      await refreshAccessToken();
      return apiClient.post("/auth/activity");
    }
    throw error;
  }
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
    const url = originalRequest?.url || "";
    const isAuthEndpoint = [
      "/auth/login",
      "/auth/refresh",
      "/auth/activity",
      "/auth/logout",
    ].some((path) => url.includes(path));

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const data = await refreshAccessToken();

      originalRequest.headers.Authorization =
        `Bearer ${data.accessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      // Only a definitive session rejection signs the user out. A 5xx,
      // 429, CORS or network failure must not end an otherwise valid
      // session — that was the cause of the "signed out while working".
      if (isSessionInvalidError(refreshError)) {
        setAccessToken(null);

        if (typeof onAuthFailure === "function") {
          onAuthFailure("expired");
        }
      }

      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
