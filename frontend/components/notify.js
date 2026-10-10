"use client";

import { toast } from "react-toastify";

/**
 * Thin wrappers so pages never import react-toastify directly.
 *
 * Each toast renders:  [status icon]  Title
 *                               Descriptive message
 * (the status icon and the close/dismiss button come from react-toastify itself.)
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

function ToastBody({ title, message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.35, minWidth: 0 }}>
      {title ? <div style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</div> : null}
      <div style={{ fontSize: 13.5, opacity: 0.95, whiteSpace: "pre-line", wordBreak: "break-word" }}>
        {message}
      </div>
    </div>
  );
}

function emit(type, message, title) {
  const text = message == null ? "" : String(message);
  const heading = title === undefined ? DEFAULT_TITLES[type] : title;
  return toast(<ToastBody title={heading} message={text} />, { type });
}

export const notify = {
  success: (msg, title) => emit("success", msg, title),
  error: (msg, title) => emit("error", msg, title || "Something went wrong"),
  info: (msg, title) => emit("info", msg, title),
  warn: (msg, title) => emit("warning", msg, title),
  warning: (msg, title) => emit("warning", msg, title),
  update: (id, msg, type = "info") => toast.update(id, { render: msg, type, autoClose: 2500 }),
};

export default notify;
