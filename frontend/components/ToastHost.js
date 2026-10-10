"use client";

import { ToastContainer } from "react-toastify";

/**
 * Global toast host. Mounted once in the root layout (app/layout.js) so
 * notifications persist across route changes and are available to every page
 * (storefront + admin).
 *
 * Positioning / behaviour:
 *  - top-left, coloured theme, entrance + exit animations (react-toastify)
 *  - auto-dismiss after 3.5s with a visible progress bar
 *  - up to 4 stacked toasts (react-toastify stacks them without overlap)
 *  - explicit close/dismiss button, pause-on-hover, draggable
 */
export default function ToastHost() {
  return (
    <ToastContainer
      position="top-left"
      autoClose={3500}
      limit={4}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      closeButton
      theme="colored"
      rtl={false}
      ariaLabel="Notifications"
    />
  );
}