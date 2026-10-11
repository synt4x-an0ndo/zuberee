"use client";

import { useEffect, useState } from "react";

/**
 * Global toast host. Mounted once in the root layout (app/layout.js) so
 * notifications persist across route changes and are available to every page
 * (storefront + admin).
 *
 * Positioning / behaviour:
 *  - top-left, coloured theme, entrance + exit animations
 *  - auto-dismiss after 3.5s with a visible progress bar
 *  - up to 4 stacked notifications
 *  - explicit close/dismiss button, pause-on-hover, draggable
 */
export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onNotification = (event) => {
      const item = event.detail;
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }, 3500);
    };
    window.addEventListener("eyara-notification", onNotification);
    return () => window.removeEventListener("eyara-notification", onNotification);
  }, []);

  return (
    <div className="eyara-toast-host" aria-live="polite" aria-label="Notifications">
      {items.map((item) => (
        <div key={item.id} className={`eyara-toast eyara-toast--${item.type}`}>
          {item.content}
        </div>
      ))}
    </div>
  );
}