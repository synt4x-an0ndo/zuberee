/**
 * =========================================================================
 * Eyara Fashion - API client
 * =========================================================================
 * Every piece of data rendered by this frontend comes from the backend API.
 * The base URL comes from NEXT_PUBLIC_API_BASE_URL (see .env.local).
 *
 * Auth model:
 *  - Login           -> POST {API}/api/auth/login  -> { success, message, data }
 *  - Token is stored in localStorage("token") AND a `token` cookie
 *  - All authenticated calls send:  Authorization: Bearer <token>
 *  - GET {API}/api/auth/me returns the current user
 *  - POST {API}/api/auth/logout invalidates the token
 * =========================================================================
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
).replace(/\/+$/, "");

/* ------------------------------------------------------------------ */
/* Token helpers                                                       */
/* ------------------------------------------------------------------ */
export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem("token") ||
      decodeURIComponent(
        (document.cookie.match(/(?:^|;\s*)token=([^;]*)/) || [])[1] || ""
      ) ||
      null
    );
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("token", token);
  const exp = new Date(Date.now() + 864e5 * 7).toUTCString();
  document.cookie = `token=${encodeURIComponent(
    token
  )}; expires=${exp}; path=/; SameSite=Lax; Secure`;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("token");
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

/** Build an absolute URL for backend-relative media paths (uploads/..., /storage/...) */
export function imgUrl(path) {
  const value = typeof path === "string" ? path.trim() : path?.image || path?.imageUrl;
  if (!value || /^(javascript|vbscript):/i.test(value)) return null;
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;
  return `${API_BASE}/${value.replace(/^\/+/, "")}`;
}

export function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

export function unwrapObject(response) {
  const value = response?.data ?? response;
  return value?.data && !Array.isArray(value.data) ? value.data : value;
}

export function unwrapList(response, keys = []) {
  const candidates = [response, response?.data, response?.data?.data, ...keys.flatMap((key) => [
    response?.[key],
    response?.data?.[key],
    response?.data?.data?.[key],
  ])];
  return candidates.find(Array.isArray) || [];
}

/* ------------------------------------------------------------------ */
/* Core request                                                        */
/* ------------------------------------------------------------------ */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * @param {string} path  e.g. "api/products?page=1"
 * @param {object} opts  { method, body, auth, formData, signal, headers }
 */
export async function request(path, opts = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    formData = false,
    signal,
    credentials = "include",
    headers: extraHeaders = {},
  } = opts;

  const headers = { Accept: "application/json", ...extraHeaders };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !(body instanceof FormData) && !formData) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}/${String(path).replace(/^\/+/, "")}`, {
    method,
    headers,
    body: payload,
    signal,
    credentials,
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      (typeof data === "string" && data.slice(0, 160)) ||
      `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  /** multipart/form-data (File uploads). `body` must be a FormData instance. */
  upload: (path, formData, opts) =>
    request(path, { ...opts, method: opts?.method || "POST", body: formData, formData: true }),
};

/* ------------------------------------------------------------------ */
/* Small domain helpers used across pages                              */
/* ------------------------------------------------------------------ */

/** Effective sale price of a product (discount wins when present). */
export function salePrice(p) {
  if (!p) return 0;
  const d = Number(p.discount);
  return Number.isFinite(d) && p.discount !== null && p.discount !== "" ? d : Number(p.price) || 0;
}

/** Stock / prebook status badge key: 'prebook' | 'in-stock' | null */
export function statusBadge(p) {
  if (!p) return null;
  if (p.status === "prebook") return "prebook";
  const summary = p.inventory_summary || p.inventory;
  const tracked =
    summary && typeof summary.track_inventory === "boolean"
      ? summary.track_inventory
      : !!p.track_inventory;
  const inStock = summary
    ? !!summary.in_stock
    : typeof summary?.total_available === "number"
      ? summary.total_available > 0
      : p.status === "in-stock";
  if (p.status === "in-stock") return "in-stock";
  if (tracked && inStock) return "in-stock";
  return null;
}

export function formatTk(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-BD") : "0";
}
