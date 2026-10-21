/** Only allow same-site relative paths in ?next= to prevent open redirects. */
export function safeNext(value, fallback = "/user") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
