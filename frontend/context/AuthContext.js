"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "@/lib/api";
import notify from "@/components/notify";

const AuthCtx = createContext(null);

function userFromResponse(response) {
  const payload = response?.data ?? response;
  if (payload?.data?.user) return payload.data.user;
  if (payload?.user) return payload.user;
  if (payload?.data && typeof payload.data === "object") return payload.data;
  return payload || null;
}

function authData(response) {
  const payload = response?.data ?? response;
  return payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
}

function dispatchAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-changed"));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const loadSession = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const sessionResponse = await api.get("api/account/me");
        let currentUser = userFromResponse(sessionResponse);
        // /account/me verifies the token; the profile endpoint supplies the name,
        // phone, and address fields needed by the account and checkout screens.
        try {
          const profileResponse = await api.get("api/account/me");
          const profile = userFromResponse(profileResponse);
          if (profile) currentUser = { ...currentUser, ...profile };
        } catch {
          // Some API deployments expose only /account/me. Keep the valid session.
        }
        if (alive) setUser(currentUser);
      } catch (error) {
        if (error.status === 401 || error.status === 403) clearToken();
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadSession();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post("api/auth/login", credentials, { auth: false });
    const data = authData(response);
    if (!data.token) throw new Error("The login response did not include an access token.");
    setToken(data.token);
    setUser(data.user || null);
    dispatchAuthChanged();
    return data.user || null;
  }, []);

  const register = useCallback(
    (details) => api.post("api/auth/register", details, { auth: false }),
    []
  );

  const logout = useCallback(async () => {
    try {
      if (getToken()) await api.post("api/auth/logout", null);
    } catch {
      // Always clear the local session, even when the server cannot be reached.
    } finally {
      clearToken();
      setUser(null);
      dispatchAuthChanged();
      notify.success("You have been signed out.", "Logged out");
    }
  }, []);

  const updateProfile = useCallback(async (details) => {
    const response = await api.put("api/account/profile", details);
    const updatedUser = userFromResponse(response);
    setUser((current) => ({ ...current, ...(updatedUser || {}) }));
    return updatedUser;
  }, []);

  const uploadAvatar = useCallback(async (file) => {
    const body = new FormData();
    body.append("image", file);
    const response = await api.upload("api/account/upload-avatar", body);
    const updatedUser = userFromResponse(response);
    setUser((current) => ({ ...current, ...(updatedUser || {}) }));
    return updatedUser;
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), login, register, logout, updateProfile, uploadAvatar }),
    [user, loading, login, register, logout, updateProfile, uploadAvatar]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const context = useContext(AuthCtx);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
