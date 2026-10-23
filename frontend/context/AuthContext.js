"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { api, AUTH_EXPIRED_EVENT, clearToken, getToken, setToken, unwrap } from "@/lib/api";

const AuthContext = createContext(null);

/** Map GET api/account/me into the shape the UI uses. */
export function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: raw.id,
    name: raw.name || "",
    email: raw.email || "",
    phone: raw.phone || "",
    image: typeof raw.image === "string" && raw.image.trim() ? raw.image : DEFAULT_AVATAR,
    role: String(raw.role || "customer").toLowerCase(),
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    // null means unverified; never infer access from the legacy role label.
    permissions: Array.isArray(raw.permissions)
      ? raw.permissions.map((permission) => typeof permission === "string" ? permission : permission?.name).filter(Boolean)
      : null,
    joinedAt: raw.joined_at || null,
    stats: raw.stats || { total_orders: 0, pending_orders: 0, delivered_orders: 0 },
    addresses: (Array.isArray(raw.addresses) ? raw.addresses : []).map((address) => ({
      id: address.id,
      fullName: address.full_name || "",
      phone: address.phone || "",
      addressLine: address.address_line || "",
      city: address.city || "",
      postalCode: address.postal_code || "",
      country: address.country || "Bangladesh",
    })),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const sessionToken = getToken();
    if (!sessionToken) return null;
    const response = await api.get("api/account/me");
    const profile = normalizeUser(unwrap(response));
    // Ignore an in-flight refresh if logout or another login changed the session.
    if (getToken() !== sessionToken) return null;
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      if (!getToken()) {
        if (alive) setLoading(false);
        return;
      }
      try {
        await loadProfile();
      } catch (error) {
        if (error?.status === 401 || error?.status === 403) clearToken();
      } finally {
        if (alive) setLoading(false);
      }
    };
    boot();

    const expire = () => {
      clearToken();
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => {
      alive = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
    };
  }, [loadProfile]);

  const login = useCallback(
    async ({ email, password }) => {
      const response = await api.post("api/auth/login", { email, password }, { auth: false });
      const payload = unwrap(response) || {};
      if (!payload.token) throw new Error("The server did not return a session token.");
      setToken(payload.token);
      try {
        return await loadProfile();
      } catch {
        // Session saved; the profile can be loaded on the next navigation.
        const fallback = normalizeUser({ ...payload.user, role: payload.user?.role });
        setUser(fallback);
        return fallback;
      }
    },
    [loadProfile]
  );

  const logout = useCallback(async () => {
    try {
      if (getToken()) await api.post("api/auth/logout", null);
    } catch {
      /* the local session is cleared regardless */
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return null;
    return loadProfile();
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin" || user?.role === "moderator",
      login,
      logout,
      refresh,
      setUser,
    }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

