"use client";

import Link from "next/link";
import { useState } from "react";
import { FiActivity, FiBox, FiRefreshCw } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Pagination, Select, Skeleton } from "@/components/ui";
import { usePermissions } from "@/context/PermissionsContext";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * Stock History (admin) — the movement ledger behind the Inventory page.
 *
 * Endpoint (backend, commit "feat: stock history & stock recived"):
 *   GET api/admin/inventory/movements ?page&per_page
 *     -> { message, data: { current_page, data: [movement...], last_page, per_page, total } }
 *     movement: { id, product_variant_id, product_id, variant_label, type, quantity,
 *                 stock_after, reserved_after, order_id, user_id, note, created_at,
 *                 product: { id, title, sku }, variant: { id, color, size },
 *                 user: { id, name } | null }
 *
 * Movement writers: receive-stock ("purchase"), order placement ("sale",
 * deducted immediately, customer + admin order creation) and cancelling or
 * deleting an undelivered order ("release"). Orders placed before sale
 * logging existed have no ledger rows. "reserve" is rendered if it ever
 * appears, but the current order flow does not hold/reserve stock.
 */

const TYPE_META = {
  purchase: { label: "Purchase", tone: "success" },
  sale: { label: "Sale", tone: "danger" },
  reserve: { label: "Reserve", tone: "warn" },
  release: { label: "Release", tone: "info" },
  adjustment: { label: "Adjustment", tone: "neutral" },
};

const quantity = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—";

const signed = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value > 0 ? `+${quantity(value)}` : quantity(value);
};

export default function InventoryMovementsPage() {
  const { can } = usePermissions();
  const allowed = can("manage inventory");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(40);

  const list = useAsync(async () => {
    if (!allowed) return null;
    const body = await api.get("api/admin/inventory/movements", {
      params: { page, per_page: perPage },
    });
    const data = body?.data;
    if (!Array.isArray(data?.data) || !Number.isInteger(data.total)) {
      throw new Error("The stock history response is invalid. Please refresh or contact support.");
    }
    return {
      rows: data.data,
      total: data.total,
      totalPages: Math.max(1, data.last_page || 1),
      currentPage: data.current_page || page,
      fetchedAt: new Date().toISOString(),
    };
  }, [allowed, page, perPage]);

  if (!allowed) return <ErrorState message="You need the manage inventory permission to view stock history." />;

  const result = list.data;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Catalogue / Inventory"
        title="Stock History"
        subtitle="Every recorded stock movement, newest first."
        actions={<div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Button href="/admin/inventory" variant="outline" size="sm">Inventory overview</Button>
          <Button variant="primary" size="sm" onClick={list.reload} loading={list.loading}>
            <FiRefreshCw aria-hidden="true" /> Refresh
          </Button>
        </div>}
      />

      <div className="notice notice-info" role="note">
        <p><strong>Receipts and orders are both recorded.</strong> Receiving stock logs a purchase, placing an order logs a sale (stock is deducted immediately), and cancelling or deleting an undelivered order logs a release. Orders placed before movement logging began have no sale row to release against.</p>
      </div>

      <Card>
        <div className="card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", borderBottom: "1px solid var(--line)" }}>
          <Field label="Rows per page" htmlFor="movement-page-size">
            <Select id="movement-page-size" value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }} options={[20, 40, 100].map((value) => ({ value, label: String(value) }))} />
          </Field>
          {result ? (
            <span className="muted" style={{ fontSize: "0.85rem", marginLeft: "auto" }}>
              {quantity(result.total)} movement{result.total === 1 ? "" : "s"} · Fetched {formatDateTime(result.fetchedAt)}
            </span>
          ) : null}
        </div>

        {list.loading && !result ? (
          <div className="card-pad" role="status" aria-label="Loading stock history"><Skeleton style={{ height: 280 }} /></div>
        ) : list.error ? (
          <div className="card-pad"><ErrorState message={list.error} onRetry={list.reload} /></div>
        ) : !result || result.rows.length === 0 ? (
          <EmptyState
            icon={FiActivity}
            title="No stock movements yet"
            text="Receive stock from the Inventory page and the movement will appear here."
            action={<Button variant="primary" href="/admin/inventory">Go to Inventory</Button>}
          />
        ) : (
          <>
            <DataTable>
              <thead><tr>
                <th>When</th><th>Product</th><th>Stock source</th><th>Type</th>
                <th className="text-right">Change</th><th className="text-right">Stock after</th>
                <th>Reference</th><th>By</th>
              </tr></thead>
              <tbody>{result.rows.map((m) => {
                const meta = TYPE_META[String(m.type || "").toLowerCase()] || { label: m.type || "Movement", tone: "neutral" };
                return (
                  <tr key={m.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(m.created_at)}</td>
                    <td>
                      <strong>{can("view products") && m.product?.id ? <Link href={`/admin/products/${m.product.id}`}>{m.product.title || `Product #${m.product.id}`}</Link> : m.product?.title || "Product unavailable"}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>{m.product?.sku || "No SKU"}</span>
                    </td>
                    <td>{m.variant_label || m.variant?.size?.size || "—"}</td>
                    <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    <td className="text-right num" style={{ fontWeight: 700, color: m.quantity > 0 ? "var(--success, #178a4c)" : m.quantity < 0 ? "var(--danger)" : undefined }}>{signed(m.quantity)}</td>
                    <td className="text-right num">{quantity(m.stock_after)}</td>
                    <td className="muted">{m.note || (m.order_id ? `Order #${m.order_id}` : "—")}</td>
                    <td>{m.user?.name || "System"}</td>
                  </tr>
                );
              })}</tbody>
            </DataTable>
            <div className="card-pad"><Pagination page={result.currentPage} totalPages={result.totalPages} onChange={setPage} /></div>
          </>
        )}
      </Card>

      <p className="muted" style={{ fontSize: "0.82rem" }}>
        <FiBox aria-hidden="true" /> Current stock balances live on the <Link href="/admin/inventory">Inventory overview</Link>. This page is the history of how those balances changed.
      </p>
    </div>
  );
}
