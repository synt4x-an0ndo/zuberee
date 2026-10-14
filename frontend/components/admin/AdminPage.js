import { cx } from "@/components/ui";

/** Standard admin page heading: eyebrow, title, optional subtitle and action buttons. */
export function AdminHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header anim-fade-up" style={{ marginBottom: "1.5rem" }}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)" }}>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

/** Wraps a table in a horizontally scrollable container with a sticky header. */
export function DataTable({ children, className = "" }) {
  return (
    <div className={cx("table-wrap", className)}>
      <table className="table">{children}</table>
    </div>
  );
}
