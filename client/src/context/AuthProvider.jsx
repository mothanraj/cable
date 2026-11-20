import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import apiClient, {
  refreshAccessTokenWithRetry,
  setAccessToken as setApiAccessToken,
  setOnAuthFailure,
  setOnSessionRefreshed,
} from "../api/client";
import AuthContext from "./AuthContext";
import { ACTIVITY_KEY } from "./sessionKeys";

export const LOGOUT_REASON_KEY = "cable:logoutReason";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] =
    useState(null);
  const [loading, setLoading] = useState(true);

  const refreshStarted = useRef(false);

  const updateAccessToken = useCallback((token) => {
    setAccessTokenState(token);
    setApiAccessToken(token);
  }, []);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSessionStartedAt(null);
    updateAccessToken(null);
  }, [updateAccessToken]);

  const applySession = useCallback(
    (data) => {
      setUser(data.user);
      setSessionStartedAt(
        data.sessionStartedAt || null
      );
      updateAccessToken(data.accessToken);
    },
    [updateAccessToken]
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await refreshAccessTokenWithRetry();
      applySession(data);
      return data.accessToken;
    } catch {
      clearAuthState();
      return null;
    }
  }, [applySession, clearAuthState]);

  const login = useCallback(
    async (username, password) => {
      const response = await apiClient.post(
        "/auth/login",
        { username, password }
      );

      const data = response.data.data;

      sessionStorage.removeItem(LOGOUT_REASON_KEY);

      // A new session starts a new idle clock. Without this, a timestamp
      // left behind by a previous session (older than the idle timeout)
      // would make the idle monitor sign the user straight back out.
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));

      applySession(data);

      return data;
    },
    [applySession]
  );

  const logout = useCallback(
    async (reason) => {
      if (reason) {
        sessionStorage.setItem(
          LOGOUT_REASON_KEY,
          reason
        );
      } else {
        sessionStorage.removeItem(LOGOUT_REASON_KEY);
      }

      try {
        await apiClient.post("/auth/logout");
      } finally {
        localStorage.removeItem(ACTIVITY_KEY);
        clearAuthState();
      }
    },
    [clearAuthState]
  );

  useEffect(() => {
    setOnSessionRefreshed((data) => {
      applySession(data);
    });

    setOnAuthFailure((reason) => {
      sessionStorage.setItem(
        LOGOUT_REASON_KEY,
        reason || "expired"
      );
      clearAuthState();
    });
  }, [applySession, clearAuthState]);

  useEffect(() => {
    if (refreshStarted.current) return;

    refreshStarted.current = true;

    refreshSession().finally(() => {
      setLoading(false);
    });
  }, [refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        sessionStartedAt,
        loading,
        login,
        logout,
        refreshSession,
        isAuthenticated: Boolean(user && accessToken),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
