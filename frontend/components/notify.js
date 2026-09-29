"use client";

import { toast } from "react-toastify";

/** Thin wrappers so pages never import react-toastify directly. */
export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg || "Something went wrong"),
  info: (msg) => toast.info(msg),
  warn: (msg) => toast.warn(msg),
};

export default notify;
