"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiInfo, FiXCircle } from "react-icons/fi";

const FeedbackContext = createContext(null);
let nextId = 1;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 220);
  }, []);

  const push = useCallback(
    (tone, message) => {
            const id = nextId++;
      const duration = tone === "error" ? 5200 : 3400;
      setToasts((list) => [...list.slice(-3), { id, tone, message, duration, leaving: false }]);
      setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push]
  );

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setDialog({
          title: options.title || "Are you sure?",
          message: options.message || "",
          confirmText: options.confirmText || "Confirm",
          cancelText: options.cancelText || "Cancel",
          danger: Boolean(options.danger),
        });
      }),
    []
  );

  const closeDialog = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeDialog(false);
      if (event.key === "Enter") closeDialog(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, closeDialog]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.tone}${t.leaving ? " is-leaving" : ""}`}>
            <span className="toast-icon" aria-hidden="true">
              {t.tone === "success" ? <FiCheckCircle /> : t.tone === "error" ? <FiXCircle /> : <FiInfo />}
            </span>
            <p>{t.message}</p>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
            <span
              className="toast-progress"
              aria-hidden="true"
              style={{ animationDuration: `${t.duration || 3400}ms` }}
            />
          </div>
        ))}
      </div>

      {dialog && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeDialog(false)}>
          <div className="dialog anim-scale-in" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
            <h2 id="dialog-title">{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-outline" onClick={() => closeDialog(false)}>
                {dialog.cancelText}
              </button>
              <button
                type="button"
                className={`btn ${dialog.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => closeDialog(true)}
                autoFocus
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return context;
}
