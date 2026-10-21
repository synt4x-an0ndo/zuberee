"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { normalizePermission, normalizeRole, normalizeUser } from "@/lib/permissions";

const PermissionsContext = createContext(null);
const EMPTY = { loading: false, status: "ready", error: "", errorStatus: 0,
  users: [], roles: [], catalog: [], permissions: [], permissionsKnown: false,
  usersError: "", rolesError: "", catalogError: "" };

export function PermissionsProvider({ children }) {
  const { user, isAuthenticated, loading: authLoading, refresh } = useAuth();
  const [state, setState] = useState({ ...EMPTY, loading: true });
  const [tick, setTick] = useState(0);
  const generation = useRef(0);
  const reload = useCallback(() => setTick(value => value + 1), []);

  useEffect(() => {
    if (authLoading) return undefined;
    const id = ++generation.current;
    const controller = new AbortController();
    const active = () => generation.current === id && !controller.signal.aborted;
    if (!isAuthenticated) { setState({ ...EMPTY }); return undefined; }
    // Retain existing screens during background refresh, but clear all access on failure.
    setState(previous => ({ ...previous, loading: !previous.permissionsKnown, error: "" }));
    const load = async () => {
      try {
        // Share AuthContext's account loader, profile normalization and Bearer auth.
        const me = await refresh();
        if (!Array.isArray(me?.permissions) || Number(me.id) !== Number(user?.id)) {
          throw new Error("The server did not return verified permissions for this account.");
        }
        const permissions = me.permissions.map(p => typeof p === "string" ? p : p?.name).filter(Boolean);
        const can = name => permissions.includes(name);
        // Failure of one management catalogue must not block unrelated authorized pages.
        const read = async (allowed, path, key, normalize) => {
          if (!allowed) return { data: [], error: "" };
          try {
            const result = await api.get(path, { signal: controller.signal });
            if (!Array.isArray(result?.[key])) throw new Error(`Invalid ${key} response.`);
            return { data: result[key].map(normalize).filter(Boolean), error: "" };
          } catch (error) {
            if (error.status === 401) throw error;
            return { data: [], error: error.message || "Request failed." };
          }
        };
        const [users, roles, catalog] = await Promise.all([
          read(can("view users"), "api/admin/users", "users", normalizeUser),
          read(can("view roles"), "api/admin/roles", "roles", normalizeRole),
          read(can("view roles") || can("create roles") || can("edit roles"), "api/admin/permissions", "permissions", normalizePermission),
        ]);
        if (!active()) return;
        setState({ ...EMPTY, status: "ready", permissionsKnown: true, permissions,
          users: users.data, roles: roles.data, catalog: catalog.data,
          usersError: users.error, rolesError: roles.error, catalogError: catalog.error });
      } catch (error) {
        if (!active()) return;
        setState({ ...EMPTY, status: error.status === 401 || error.status === 403 ? "denied" : "error",
          error: error.message || "Authorization could not be verified.", errorStatus: error.status || 0 });
      }
    };
    load();
    return () => controller.abort();
  }, [authLoading, isAuthenticated, user?.id, refresh, tick]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer); };
  }, [reload]);
  const can = useCallback(name => state.permissionsKnown && state.permissions.includes(name), [state.permissionsKnown, state.permissions]);
  const value = useMemo(() => ({ ...state, reload, can, canShow: can,
    canAny: names => Array.isArray(names) && names.some(can),
    canAll: names => Array.isArray(names) && names.length > 0 && names.every(can),
  }), [state, reload, can]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}
export function usePermissions() {
  return useContext(PermissionsContext) || { ...EMPTY, reload: () => {}, can: () => false,
    canAny: () => false, canAll: () => false, canShow: () => false };
}
