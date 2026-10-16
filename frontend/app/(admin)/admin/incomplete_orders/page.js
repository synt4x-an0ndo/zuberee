"use client";

import { useState } from "react";
import { FiFilter, FiInbox, FiRefreshCw } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Pagination, Select, Skeleton } from "@/components/ui";
import { api, formatMoney } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * GET /api/admin/abandoned-checkouts   (admin JWT)
 *   query: search, status (pending|cancelled|completed|converted), recovered (true|false), page, per_page
 *   -> { success, message, data:[{ id, session_id, user_id, cart_items, name, phone, address,
 *                                  is_recovered, status, converted_order_id, converted_at,
 *                                  created_at, updated_at }],
 *        meta:{ current_page, per_page, total, total_pages, has_more, from, to } }
 *
 * The rows are written by POST /api/abandoned-checkouts, which the storefront fires from the
 * checkout page while a shopper is filling the form.
 */
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Cancelled" },
];

const RECOVERED_OPTIONS = [
  { value: "", label: "Recovered & not" },
  { value: "true", label: "Recovered only" },
  { value: "false", label: "Not recovered" },
];

const STATUS_TONE = { pending: "warn", completed: "success", converted: "brand", cancelled: "neutral" };

function cartSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return { count: 0, total: 0, label: "—" };
  const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total = items.reduce((sum, item) => sum + Number(item.unitPrice ?? item.unit_price ?? 0) * Number(item.quantity || 0), 0);
  const label = items
    .slice(0, 2)
    .map((item) => `${item.title || item.name || `#${item.productId ?? item.product_id ?? "?"}`} ×${item.quantity ?? 1}`)
    .join(", ");
  return { count, total, label: items.length > 2 ? `${label} +${items.length - 2} more` : label };
}

export default function IncompleteOrdersPage() {
  const [filters, setFilters] = useState({ search: "", status: "", recovered: "" });
  const [applied, setApplied] = useState({ search: "", status: "", recovered: "" });
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync(async () => {
    const params = { page, per_page: 20 };
    if (applied.search.trim()) params.search = applied.search.trim();
    if (applied.status) params.status = applied.status;
    if (applied.recovered) params.recovered = applied.recovered;
    const body = await api.get("api/admin/abandoned-checkouts", { params });
    return {
      rows: Array.isArray(body.data) ? body.data : [],
      meta: body.meta || {},
    };
  }, [applied, page]);

  const rows = data?.rows || [];
  const meta = data?.meta || {};

  const submit = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const reset = () => {
    const empty = { search: "", status: "", recovered: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Sales"
        title="Incomplete orders"
        subtitle="Checkouts where a shopper entered details but never placed the order."
        actions={<Button variant="ghost" size="sm" onClick={reload}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      <Card>
        <CardHeader title="Filter incomplete orders" subtitle="Search by name, phone or session, and narrow by status." />
        <form onSubmit={submit} className="card-pad" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Search" htmlFor="inc-search" className="grow">
            <Input id="inc-search" placeholder="Name, phone or session id" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
          </Field>
          <Field label="Status" htmlFor="inc-status">
            <Select id="inc-status" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} options={STATUS_OPTIONS} />
          </Field>
          <Field label="Recovered" htmlFor="inc-recovered">
            <Select id="inc-recovered" value={filters.recovered} onChange={(e) => setFilters((f) => ({ ...f, recovered: e.target.value }))} options={RECOVERED_OPTIONS} />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <Button type="submit" variant="primary"><FiFilter aria-hidden="true" /> Filter</Button>
            <Button type="button" variant="outline" onClick={reset}>Reset</Button>
          </div>
        </form>
      </Card>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 360 }} /> : rows.length === 0 ? (
        <EmptyState
          icon={FiInbox}
          title="No incomplete orders"
          text="Nothing has been left behind at checkout yet. Rows appear here when a shopper enters contact details and stops before placing the order."
        />
      ) : (
        <Card>
          <CardHeader title="Incomplete orders" subtitle={`${meta.total ?? rows.length} record${(meta.total ?? rows.length) === 1 ? "" : "s"}`} />
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Address</th>
                <th>Cart</th>
                <th>Value</th>
                <th>Status</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cart = cartSummary(row.cart_items);
                return (
                  <tr key={row.id}>
                    <td className="num">{row.id}</td>
                    <td>
                      <strong>{row.name || "Guest"}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>{row.phone || "No phone"}</span>
                      <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{row.session_id}</span>
                    </td>
                    <td className="muted" style={{ maxWidth: 240 }}>{row.address || "—"}</td>
                    <td>
                      {cart.count} item{cart.count === 1 ? "" : "s"}
                      <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>{cart.label}</span>
                    </td>
                    <td className="num">{cart.total ? formatMoney(cart.total) : "—"}</td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status] || "neutral"}>{row.status || "pending"}</Badge>
                      {row.is_recovered && <Badge tone="success" className="ml-1">Recovered</Badge>}
                      {row.converted_order_id ? (
                        <span className="muted" style={{ display: "block", fontSize: "0.78rem", marginTop: 4 }}>Order #{row.converted_order_id}</span>
                      ) : null}
                    </td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.updated_at || row.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={meta.current_page || page} totalPages={meta.total_pages || 1} onChange={setPage} />
        </Card>
      )}

      <div className="notice notice-info" role="note">
        <span>
          There is no backend endpoint to mark a checkout as recovered or to convert it into an order
          (the dashboard variants do not exist), so those actions are intentionally not offered here.
        </span>
      </div>
    </div>
  );
}
