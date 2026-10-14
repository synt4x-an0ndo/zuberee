"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FiChevronLeft, FiChevronRight, FiInbox, FiX } from "react-icons/fi";

const cx = (...parts) => parts.filter(Boolean).join(" ");
export { cx };

export function Spinner({ className = "" }) {
  return <span className={cx("spinner", className)} role="status" aria-label="Loading" />;
}

export function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  icon: Icon,
  className = "",
  children,
  disabled,
  href,
  ...rest
}) {
  const classes = cx(
    "btn",
    `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    block && "btn-block",
    loading && "is-loading",
    className
  );
  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {Icon && <Icon aria-hidden="true" />}
        {children}
      </Link>
    );
  }
  return (
    <Tag className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="btn-spinner" /> : Icon && <Icon aria-hidden="true" />}
      {children && <span>{children}</span>}
    </Tag>
  );
}

export function Field({ label, htmlFor, hint, error, required, children, className = "" }) {
  return (
    <div className={cx("field", error && "has-error", className)}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className = "", ...props }) {
  return <input className={cx("input", className)} {...props} />;
}

export function Textarea({ className = "", rows = 4, ...props }) {
  return <textarea rows={rows} className={cx("input textarea", className)} {...props} />;
}

export function Select({ className = "", options = [], placeholder, children, ...props }) {
  return (
    <select className={cx("input select", className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={cx("toggle", disabled && "is-disabled")}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}

export function Badge({ tone = "neutral", children, className = "" }) {
  return <span className={cx("badge", `badge-${tone}`, className)}>{children}</span>;
}

export function Card({ className = "", children, as: Tag = "section", ...rest }) {
  return (
    <Tag className={cx("card", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, actions }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className = "", style }) {
  return <span className={cx("skeleton", className)} style={style} aria-hidden="true" />;
}

export function EmptyState({ title, text, action, icon: Icon = FiInbox }) {
  return (
    <div className="empty anim-fade-up">
      <span className="empty-icon">
        <Icon aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="notice notice-danger anim-fade-up" role="alert">
      <p>{message || "Something went wrong."}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <header className="page-header anim-fade-up">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let p = start; p <= end; p += 1) pages.push(p);
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="pager-btn" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <FiChevronLeft aria-hidden="true" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={cx("pager-btn", p === page && "is-active")}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      ))}
      <button type="button" className="pager-btn" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <FiChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}

export function Modal({ open, onClose, title, children, footer, width = "560px" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal anim-scale-in" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone = "brand", icon: Icon }) {
  return (
    <div className={cx("stat", `stat-${tone}`)}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon aria-hidden="true" />
          </span>
        )}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
