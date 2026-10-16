/**
 * API client for the Eyara Fashion backend (Next.js route handlers in /backend).
 *
 * - Base URL comes from NEXT_PUBLIC_API_BASE_URL. It is never guessed: when it is
 *   empty, every request fails fast with ApiError code API_NOT_CONFIGURED.
 * - Auth is a bearer token returned by POST api/auth/login. It is kept in
 *   localStorage (and mirrored in a cookie) and sent as `Authorization: Bearer`.
 * - Guest carts are identified by the backend's httpOnly `cart_session_id`
 *   cookie, so every request is sent with credentials: "include".
 */

const rawBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
export const API_BASE = rawBase.replace(/\/+$/, "");
export const API_CONFIGURED = Boolean(API_BASE);

export const AUTH_EXPIRED_EVENT = "eyara:auth-expired";
const TOKEN_KEY = "token";

/* ------------------------------------------------------------------ */
/* Token storage                                                       */
/* ------------------------------------------------------------------ */
export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    /* storage blocked – fall through to cookie */
  }
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setToken(token) {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  const expires = new Date(Date.now() + 7 * 864e5).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `token=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = "token=; Max-Age=0; path=/; SameSite=Lax";
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Resolve a backend-relative media path (/storage/..., /api/banners/1/image) to an absolute URL. */
export function imgUrl(input) {
  const raw =
    typeof input === "string"
      ? input
      : input?.image ?? input?.imageUrl ?? input?.logo_path ?? input?.company_logo ?? null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || /^(javascript|vbscript):/i.test(value)) return null;
  if (/^(data|blob):/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (!API_BASE) return null;
  return `${API_BASE}/${value.replace(/^\/+/, "")}`;
}

/** Return the payload of `{ success, message, data }` (or the bare response when there is no envelope). */
export function unwrap(response) {
  if (response && typeof response === "object" && "data" in response) return response.data;
  return response;
}

/** Return an array from either a bare array or a `{ data: [] }` envelope. */
export function listOf(response) {
  const value = unwrap(response);
  return Array.isArray(value) ? value : [];
}

/** Money formatting without locale APIs, so server and client markup match. */
export function formatMoney(value) {
  const number = Math.round(Number(value) || 0);
  return `৳${number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/* ------------------------------------------------------------------ */
/* Core request                                                        */
/* ------------------------------------------------------------------ */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Some backend routes (dashboard/summary, inventory/*, sizes, admin/sizes) answer with
 * `{ message: "failed", data: "<the real explanation>" }` instead of the usual
 * `{ success: false, message: "<the real explanation>" }`. If the client trusted `message`
 * blindly the UI would only ever show the word "failed", so those placeholder tokens are
 * skipped in favour of the specific text the response also carries.
 */
const PLACEHOLDER_MESSAGES = new Set(["failed", "fail", "failure", "error", "unsuccessful", "false"]);

function isPlaceholder(value) {
  return PLACEHOLDER_MESSAGES.has(String(value).trim().toLowerCase());
}

function errorMessage(status, data) {
  if (data && typeof data === "object") {
    const candidates = [data.message, data.error, data.data, data.detail].filter(
      (value) => typeof value === "string" && value.trim()
    );
    const specific = candidates.find((value) => !isPlaceholder(value));
    if (specific) return specific.trim();
    // Every candidate was a placeholder token (e.g. { message: "failed", data: null }) — fall
    // through to the status-based wording below rather than showing the user "failed".
    if (data.errors && typeof data.errors === "object") {
      const flat = Object.values(data.errors).flat().filter(Boolean).join(" ");
      if (flat) return flat;
    }
  }
  if (typeof data === "string" && data.trim() && data.length < 200) return data.trim();
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 422) return "Please check the highlighted fields.";
  if (status >= 500) return "The server ran into a problem. Please try again.";
  return `Request failed (${status}).`;
}

export async function request(path, options = {}) {
  const { method = "GET", body, auth = true, params, signal, headers: extra = {} } = options;

  if (!API_CONFIGURED) {
    throw new ApiError("The storefront API is not configured yet.", 0, { code: "API_NOT_CONFIGURED" });
  }

  const url = new URL(`${API_BASE}/${String(path).replace(/^\/+/, "")}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
      else url.searchParams.set(key, String(value));
    }
  }

  const headers = { Accept: "application/json", ...extra };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    payload = body;
  } else if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: payload,
      signal,
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("We could not reach the server. Check your connection and try again.", 0, {
      code: "NETWORK",
    });
  }

  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token && typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(errorMessage(response.status, data), response.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  /** PATCH routes in the backend: /api/admin/orders/:id, /api/admin/customer-leaderboard/:key/badge */
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  upload: (path, formData, opts = {}) =>
    request(path, { ...opts, method: opts.method || "POST", body: formData }),
};

/* ------------------------------------------------------------------ */
/* Domain helpers                                                      */
/* ------------------------------------------------------------------ */

/** Turn a Bangladeshi mobile number into a 01XXXXXXXXX string where possible. */
export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  return digits;
}

export function isValidBdPhone(value) {
  return /^01[3-9]\d{8}$/.test(normalizePhone(value));
}
