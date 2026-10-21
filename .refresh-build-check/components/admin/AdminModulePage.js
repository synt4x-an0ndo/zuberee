"use client";

import { useMemo, useState } from "react";
import { FiDownload, FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";

/**
 * Placeholder module shell for sections whose backend API is not connected yet.
 *
 * Pass `rows` (array of `{ key, searchText, cells }`) to list local/static
 * records with a working client-side search instead of the empty placeholder
 * table. `cells` must be plain serializable values rendered one per column.
 */
export default function AdminModulePage({
  eyebrow = "Administration",
  title,
  subtitle,
  description = "This section is ready for the upcoming backend integration.",
  columns = ["Name", "Status", "Updated"],
  actionLabel = "Add new",
  stats = [],
  filters = true,
  rows = null,
}) {
  const { toast } = useFeedback();
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => String(row.searchText || "").toLowerCase().includes(term));
  }, [rows, query]);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => toast.info("This module will refresh when its API is connected.")}>
              <FiRefreshCw aria-hidden="true" /> Refresh
            </Button>
            {actionLabel ? <Button variant="primary" onClick={() => toast.info("This action will be enabled when the backend API is connected.")}><FiPlus aria-hidden="true" /> {actionLabel}</Button> : null}
          </div>
        }
      />

      {stats.length > 0 && (
        <div className="stat-grid stagger">
          {stats.map((stat) => <Stat key={stat.label} {...stat} />)}
        </div>
      )}

      <Card>
        <CardHeader
          title={title}
          subtitle={description}
          actions={<Button variant="outline" size="sm" onClick={() => toast.info("Export will be enabled with the backend API.")}><FiDownload aria-hidden="true" /> Export</Button>}
        />
        {filters && (
          <div className="card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", borderBottom: "1px solid var(--line)" }}>
            <Field label="Search" htmlFor="module-search">
              <div style={{ position: "relative" }}>
                <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
                <Input id="module-search" placeholder="Search records" style={{ paddingLeft: 36 }} value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
            </Field>
            {!rows && (
              <Field label="Status" htmlFor="module-status">
                <Select id="module-status" placeholder="All statuses" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} onChange={() => {}} />
              </Field>
            )}
          </div>
        )}
        <DataTable>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {filteredRows ? (
              filteredRows.length > 0 ? (
                filteredRows.map((row, rowIndex) => (
                  <tr key={row.key || rowIndex}>
                    {row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={columns.length}><EmptyState title="No records match your search" text="Try a different search term." /></td></tr>
              )
            ) : (
              <tr><td colSpan={columns.length}><EmptyState title="No records yet" text="The page layout is ready. Records will appear when the backend endpoint is connected." /></td></tr>
            )}
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
}
