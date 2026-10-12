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
 *  - GET {API}/api/account/me returns the current user
 *  - POST {API}/api/auth/logout invalidates the token
 * =========================================================================
 */

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";

/** Empty means deliberately unconfigured: never silently call localhost. */
export const API_BASE = configuredApiBase.replace(/\/+$/, "");
export const API_CONFIGURED = Boolean(API_BASE);

/* ------------------------------------------------------------------ */
/* Token helpers                                                       */
/* ------------------------------------------------------------------ */
export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("token");
    if (stored) return stored;
  } catch {
    // Continue to the cookie fallback if local storage is disabled.
  }
  try {
    const cookie = (document.cookie.match(/(?:^|;\s*)token=([^;]*)/) || [])[1];
    return cookie ? decodeURIComponent(cookie) : null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem("token", token);
  } catch {
    // The Authorization header remains the source of truth if storage is blocked.
  }
  const exp = new Date(Date.now() + 864e5 * 7).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `token=${encodeURIComponent(token)}; expires=${exp}; path=/; SameSite=Lax${secure}`;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("token");
  } catch {
    // Ignore storage restrictions while still expiring the cookie.
  }
  document.cookie = "token=; Max-Age=0; path=/; SameSite=Lax";
}

/** Build an absolute URL for backend-relative media paths (uploads/..., /storage/...). */
export function imgUrl(path) {
  const raw = typeof path === "string" ? path : path?.image || path?.imageUrl;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || /^(javascript|vbscript):/i.test(value)) return null;
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;
  if (!API_BASE) return null;
  return `${API_BASE}/${value.replace(/^\/+/, "")}`;
}

export function productColors(product) {
  if (!Array.isArray(product?.colors)) return [];
  return product.colors.filter((color) => color && typeof color === "object");
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
 * Join the base URL, a path (which may already contain a query string) and
 * extra params without ever emitting a stray/duplicate "?".
 * e.g. buildUrl("api/products?page=1", empty) -> ".../api/products?page=1"
 */
function buildUrl(path, params) {
  const normalizedPath = String(path).replace(/^\/+/, "");
  const query = params.toString();
  const hasQueryInPath = normalizedPath.includes("?");
  if (!query) return `${API_BASE}/${normalizedPath}`;
  return `${API_BASE}/${normalizedPath}${hasQueryInPath ? "&" : "?"}${query}`;
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

  if (!API_BASE) {
    throw new ApiError(
      "The storefront API is not configured. Set NEXT_PUBLIC_API_BASE_URL to connect the backend.",
      0,
      { code: "API_NOT_CONFIGURED" }
    );
  }

  const params = new URLSearchParams();
  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      if (value === null || value === undefined) continue;
      params.append(key, String(value));
    }
  }

  let payload = body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body != null && !isFormData && !formData) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: payload,
      signal,
      credentials,
      cache: "no-store",
    }
  );

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const validationMessage = data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors).flat().filter(Boolean).join(" ")
      : "";
    const msg =
      (data && (data.message || data.error)) ||
      validationMessage ||
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

export function normalizedProductStatus(product) {
  return String(product?.status || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

export function isPreorderStatus(productOrStatus) {
  const status = typeof productOrStatus === "string"
    ? productOrStatus.trim().toLowerCase().replace(/[_\s]+/g, "-")
    : normalizedProductStatus(productOrStatus);
  return ["prebook", "pre-book", "pre-order", "preorder"].includes(status);
}

/** Stock badge key: 'prebook' | 'in-stock' | 'sold-out' | null. */
export function statusBadge(product) {
  if (!product) return null;
  const status = normalizedProductStatus(product);
  if (isPreorderStatus(status)) return "prebook";
  if (["out-of-stock", "sold-out", "discontinued"].includes(status)) return "sold-out";

  const summary = product.inventory_summary || product.inventory || {};
  const tracked = asBoolean(summary.track_inventory ?? product.track_inventory, false);
  const inStock = typeof summary.in_stock === "boolean"
    ? summary.in_stock
    : typeof summary.total_available === "number"
      ? summary.total_available > 0
      : status === "in-stock" || status === "available";
  if (status === "in-stock" || status === "available" || (tracked && inStock)) {
    return "in-stock";
  }
  return null;
}

export function formatTk(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-BD") : "0";
}
