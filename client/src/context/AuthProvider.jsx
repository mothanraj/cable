import { useEffect, useRef, useState } from "react";
import apiClient, {
  setAccessToken as setApiAccessToken,
} from "../api/client";
import AuthContext from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshStarted = useRef(false);

  function updateAccessToken(token) {
    setAccessTokenState(token);
    setApiAccessToken(token);
  }

  async function refreshSession() {
    try {
      const response = await apiClient.post("/auth/refresh");
      const data = response.data.data;

      setUser(data.user);
      updateAccessToken(data.accessToken);

      return data.accessToken;
    } catch {
      setUser(null);
      updateAccessToken(null);
      return null;
    }
  }

  async function login(username, password) {
    const response = await apiClient.post("/auth/login", {
      username,
      password,
    });

    const data = response.data.data;

    setUser(data.user);
    updateAccessToken(data.accessToken);

    return data;
  }

  async function logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setUser(null);
      updateAccessToken(null);
    }
  }

  useEffect(() => {
    if (refreshStarted.current) return;

    refreshStarted.current = true;

    refreshSession().finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
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