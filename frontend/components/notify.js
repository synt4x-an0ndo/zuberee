"use client";

/**
 * Thin wrappers so pages use one notification API.
 *
 * Each toast renders:  [status icon]  Title
 *                               Descriptive message
 * The host component owns rendering and dismissal.
 *
 * Every existing call site keeps working with a single message argument; a short
 * per-type title is added automatically. Pass an explicit title as the second
 * argument (or `null` to suppress it):
 *   notify.success("Welcome back!", "Login Successful!");
 */
const DEFAULT_TITLES = {
  success: "Success",
  error: "Error",
  info: "Info",
  warning: "Warning",
};

function emit(type, message, title) {
  const text = message == null ? "" : String(message);
  const heading = title === undefined ? DEFAULT_TITLES[type] : title;
  const content = heading ? `${heading}: ${text}` : text;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eyara-notification", {
      detail: { id: `${Date.now()}-${Math.random()}`, type, content },
    }));
  }
  return null;
}

export const notify = {
  success: (msg, title) => emit("success", msg, title),
  error: (msg, title) => emit("error", msg, title || "Something went wrong"),
  info: (msg, title) => emit("info", msg, title),
  warn: (msg, title) => emit("warning", msg, title),
  warning: (msg, title) => emit("warning", msg, title),
  update: (id, msg, type = "info") => emit(type, msg),
};

export default notify;
