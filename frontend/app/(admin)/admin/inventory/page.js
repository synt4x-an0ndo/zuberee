"use client";

import Link from "next/link";
import { useState } from "react";
import { FiAlertTriangle, FiImage, FiSearch } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Pagination, Skeleton, Stat, Toggle, cx } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, imgUrl } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

/**
 * Inventory (admin) — layout: header with Stock History / Receive Stock actions,
 * "Counting only" enforcement toggle (site-settings), five stock stat cards,
 * filter chips + search, and the variant stock table with Adjust / Grid actions.
 *
 * Endpoints (existing backend, verified):
 *   GET api/admin/inventory/summary  -> { data: { units_on_hand, units_reserved, low_stock,
 *        out_of_stock, tracked_products, total_variants, stock_value, low_stock_threshold } }
 *   GET api/admin/inventory/variants ?search&filter&page&per_page
 *        filter: all | in_stock | low_stock | out_of_stock | preorder | tracked
 *   GET/PUT api/admin/site-settings  -> inventory_enforcement_enabled ("Counting only" toggle)
 *
 * Not wired (no backend endpoint exists yet — buttons show an honest notice):
 *   Receive Stock, Stock History, per-variant Adjust (the product PUT replaces all
 *   variants, so it is not safe for a single-variant stock edit; Grid opens the
 *   product editor where stock per size can be saved).
 */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "preorder", label: "Pre-order" },
  { value: "tracked", label: "Tracked only" },
];

/** 1236 -> "1,236" without locale APIs, so server and client markup match. */
function fmt(value) {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function statusOf(row) {
  if ((row.available ?? 0) <= 0) return { label: "Out", tone: "danger" };
  if (row.low_stock) return { label: "Low", tone: "warn" };
  if (row.allow_preorder || row.product?.status === "pre-order") return { label: "Pre-order", tone: "info" };
  return { label: "In", tone: "success" };
}

export default function InventoryPage() {
  const { toast } = useFeedback();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [savingMode, setSavingMode] = useState(false);

  const summary = useAsync(async () => {
    const [sum, site] = await Promise.all([
      api.get("api/admin/inventory/summary").then((b) => b.data),
      api.get("api/admin/site-settings").then((b) => b?.data || {}).catch(() => ({})),
    ]);
    return { sum, site };
  }, []);

  const list = useAsync(async () => {
    const params = { filter, page, per_page: 20 };
    if (search.trim()) params.search = search.trim();
    const body = await api.get("api/admin/inventory/variants", { params });
    // The endpoint returns { message, data: { current_page, data: [...], total, total_pages, ... } },
    // i.e. the pagination object wraps the rows a second time.
    const pagination = body?.data || {};
    return {
      rows: Array.isArray(pagination.data) ? pagination.data : [],
      meta: {
        current_page: pagination.current_page,
        total_pages: pagination.total_pages,
        total: pagination.total,
      },
    };
  }, [filter, page, search]);

  const s = summary.data?.sum;
  const enforcement = Boolean(summary.data?.site?.inventory_enforcement_enabled);

  const setEnforcement = async (value) => {
    setSavingMode(true);
    try {
      await api.put("api/admin/site-settings", { inventory_enforcement_enabled: value });
      toast.success(value
        ? "Stock blocking is on — orders that exceed stock are refused."
        : "Counting only — stock is tracked, but no order is ever refused.");
      summary.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingMode(false);
    }
  };

  const notWired = (feature) => () =>
    toast.info(`${feature} needs a dedicated backend endpoint that does not exist yet.`);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Catalogue"
        title="Inventory"
        subtitle="Stock is held when an order is placed and deducted once you mark it Order Confirmed. Cancelling or returning puts it back."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={notWired("Stock history")}>Stock History</Button>
            <Button variant="primary" size="sm" onClick={notWired("Receiving stock")}>Receive Stock</Button>
          </div>
        }
      />

      <Card>
        <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="stack" style={{ gap: 4 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>Counting only</span>
              <Badge tone={enforcement ? "warn" : "neutral"}>{enforcement ? "ON" : "OFF"}</Badge>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Stock is held and deducted as normal, but no order is ever refused. Safe to leave here until your counts are verified.
            </p>
          </div>
          <Toggle checked={enforcement} disabled={savingMode} onChange={setEnforcement} label="" />
        </div>
      </Card>

      {summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : !s ? (
        <div className="stat-grid"><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /></div>
      ) : (
        <div className="stat-grid stagger">
          <Stat label="Available units" tone="success" value={fmt(Math.max(0, (s.units_on_hand ?? 0) - (s.units_reserved ?? 0)))} hint={`${fmt(s.units_on_hand ?? 0)} on hand · ${fmt(s.units_reserved ?? 0)} held`} />
          <Stat label="Low stock" tone="warn" value={fmt(s.low_stock ?? 0)} hint={`At or below ${s.low_stock_threshold ?? 3} units`} />
          <Stat label="Out of stock" tone="danger" value={fmt(s.out_of_stock ?? 0)} hint="Nothing left to sell" />
          <Stat label="Tracked products" tone="info" value={fmt(s.tracked_products ?? 0)} hint={`${fmt(s.total_variants ?? 0)} colour/size rows`} />
          <Stat label="Stock value" tone="brand" value={formatMoney(s.stock_value ?? 0)} hint="At recorded purchase cost" />
        </div>
      )}

      <div className="card card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 320px" }}>
          <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
          <Input aria-label="Search inventory" placeholder="Search product name, product SKU or variant SKU..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 36 }} />
        </div>
        <div className="tabs" role="tablist" aria-label="Inventory filters" style={{ margin: 0 }}>
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className={cx("tab", filter === f.value && "is-active")} onClick={() => { setFilter(f.value); setPage(1); }}>{f.label}</button>
          ))}
        </div>
      </div>

      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data ? <Skeleton style={{ height: 420 }} /> : list.data.rows.length === 0 ? (
        <EmptyState icon={FiAlertTriangle} title="No variants match" text="Try another filter or search term." />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Held</th>
                <th className="text-right">Available</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((v) => {
                const status = statusOf(v);
                const tracked = Boolean(v.product?.track_inventory);
                const imageSrc = imgUrl(v.product?.first_image?.image);
                return (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {imageSrc ? (
                          <img src={imageSrc} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)", background: "var(--paper, #fff)" }} />
                        ) : (
                          <span style={{ width: 44, height: 44, borderRadius: 8, border: "1px solid var(--line)", background: "var(--brand-tint, #f2f5f3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><FiImage aria-hidden="true" /></span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          {v.product?.id ? <Link href={`/admin/products/${v.product.id}`}><strong>{v.product.title || "Product"}</strong></Link> : <strong>{v.product?.title || "Product"}</strong>}
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                            {v.sku && <span className="num" style={{ fontSize: "0.78rem", padding: "1px 8px", borderRadius: 6, background: "var(--brand-soft, #e4ebe6)", color: "var(--muted)" }}>{v.sku}</span>}
                            {!tracked && <Badge tone="neutral">not tracked</Badge>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {v.color?.code ? <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 999, background: v.color.code, border: "1px solid var(--line)", display: "inline-block" }} /> : null}
                        <span className="muted">{v.label || "—"}</span>
                      </span>
                    </td>
                    <td className="text-right num">{fmt(v.stock)}</td>
                    <td className="text-right num">{fmt((v.reserved ?? 0) + (v.held ?? 0))}</td>
                    <td className="text-right num" style={{ fontWeight: 700, color: (v.available ?? 0) <= 0 ? "var(--danger)" : undefined }}>{fmt(v.available)}</td>
                    <td><Badge tone={status.tone}>{status.label}</Badge></td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Button type="button" variant="outline" size="sm" onClick={notWired("Per-variant stock adjustment")}>Adjust</Button>
                        {v.product?.id ? (
                          <Button type="button" variant="primary" size="sm" href={`/admin/products/${v.product.id}`}>Grid</Button>
                        ) : (
                          <Button type="button" variant="primary" size="sm" disabled>Grid</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Pagination page={list.data.meta.current_page || page} totalPages={list.data.meta.total_pages || 1} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
