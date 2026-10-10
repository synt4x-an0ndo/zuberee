"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "@/lib/api";

const AuthCtx = createContext(null);

function userFromResponse(response) {
    return response?.data?.user || response?.data?.data?.user || response?.data?.data || response?.data || null;
}

function authData(response) {
    return response?.data?.data || response?.data || {};
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!getToken()) {
            setLoading(false);
            return;
        }
        api.get("api/auth/me")
            .then((response) => setUser(userFromResponse(response)))
            .catch((error) => {
                if (error.status === 401 || error.status === 403) clearToken();
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (credentials) => {
        const response = await api.post("api/auth/login", credentials, { auth: false });
        const data = authData(response);
        setToken(data.token);
        setUser(data.user);
        window.dispatchEvent(new Event("auth-changed"));
        return data.user;
    };

    const register = async (details) => {
        return api.post("api/auth/register", details, { auth: false });
    };

    const logout = async () => {
        try {
            await api.post("api/auth/logout", null);
        } finally {
            clearToken();
            setUser(null);
            window.dispatchEvent(new Event("auth-changed"));
        }
    };

    const updateProfile = async (details) => {
        const response = await api.patch("api/account/profile", details);
        const nextUser = userFromResponse(response);
        setUser(nextUser);
        return nextUser;
    };

    const value = useMemo(
        () => ({ user, loading, isAuthenticated: Boolean(user), login, register, logout, updateProfile }),
        [user, loading]
    );

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
    const context = useContext(AuthCtx);
    if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
    return context;
}