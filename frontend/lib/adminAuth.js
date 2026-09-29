"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, clearToken } from "@/lib/api";
import notify from "@/components/notify";

/**
 * Admin auth helpers (same contract as the original dashboard):
 *  - token / user_id / roles / permissions kept in localStorage + cookies
 *  - hasPermission(): super-admin bypasses every permission check
 *  - refreshUserData(): GET api/me -> latest roles + permissions
 *  - logout(): POST api/logOut then clear everything
 */
export function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function useAdminAuth({ permission, role, autoRefresh = true } = {}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userName, setUserName] = useState("");
  const [allowed, setAllowed] = useState(true);

  const load = useCallback(() => {
    setPermissions(readJSON("permissions", []));
    setRoles(readJSON("roles", []));
    setUserName(localStorage.getItem("user_name") || "");
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href =
        "/frontEnd/admin?redirect=" +
        encodeURIComponent(window.location.pathname);
      return;
    }
    load();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* permission gate */
  useEffect(() => {
    if (!ready) return;
    const isSuper = roles.includes("super-admin");
    let ok = true;
    if (permission) ok = isSuper || permissions.includes(permission);
    if (role) ok = roles.includes(role);
    setAllowed(ok);
  }, [ready, permissions, roles, permission, role]);

  /* refresh profile from the API */
  const refreshUserData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const r = await api.get("api/me");
        if (r?.user) {
          localStorage.setItem("roles", JSON.stringify(r.user.roles || []));
          localStorage.setItem(
            "permissions",
            JSON.stringify(r.user.permissions || [])
          );
          localStorage.setItem("user_name", r.user.name || "");
          setRoles(r.user.roles || []);
          setPermissions(r.user.permissions || []);
          setUserName(r.user.name || "");
        }
        return r?.user;
      } catch (e) {
        if (e.status === 401) {
          clearToken();
          window.location.href = "/frontEnd/admin";
        } else if (!silent) {
          console.error(e);
        }
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (ready && autoRefresh) refreshUserData({ silent: true });
  }, [ready, autoRefresh, refreshUserData]);

  const logout = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        await api.post("api/logOut", undefined, { auth: true });
      }
    } catch {
      /* ignore */
    } finally {
      clearToken();
      ["user_id", "user_name", "roles", "permissions"].forEach((k) =>
        localStorage.removeItem(k)
      );
      ["user_id", "roles", "permissions"].forEach(
        (k) => (document.cookie = `${k}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`)
      );
      notify.success("Logged out successfully");
      window.location.href = "/frontEnd/admin";
    }
  }, []);

  const hasPermission = useCallback(
    (p) => roles.includes("super-admin") || permissions.includes(p),
    [roles, permissions]
  );
  const hasRole = useCallback((r) => roles.includes(r), [roles]);

  return useMemo(
    () => ({
      ready,
      allowed,
      permissions,
      roles,
      userName,
      hasPermission,
      hasRole,
      refreshUserData,
      logout,
    }),
    [ready, allowed, permissions, roles, userName, hasPermission, hasRole, refreshUserData, logout]
  );
}
