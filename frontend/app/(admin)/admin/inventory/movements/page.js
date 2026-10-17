"use client";

import Link from "next/link";
import { useState } from "react";
import { FiAlertTriangle, FiBox, FiLayers, FiRefreshCw, FiSearch } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Pagination, Select, Skeleton, Stat } from "@/components/ui";
import { usePermissions } from "@/context/PermissionsContext";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const quantity = (value) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—";

/** Read-only stock snapshots. The backend does not expose a movement ledger. */
export default function InventoryMovementsPage() {
  const { can } = usePermissions();
  const allowed = can("manage inventory");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const summary = useAsync(async () => {
    if (!allowed) return null;
    const body = await api.get("api/admin/inventory/summary");
    if (!body?.data || typeof body.data.total_variants !== "number") {
      throw new Error("The inventory summary response is invalid. Please refresh or contact support.");
    }
    return body.data;
  }, [allowed]);

  const list = useAsync(async () => {
    if (!allowed) return null;
    const body = await api.get("api/admin/inventory/variants", {
      params: { search, page, per_page: perPage, filter: "all" },
    });
    const data = body?.data;
    if (!Array.isArray(data?.data) || !Number.isInteger(data.total) || !Number.isInteger(data.total_pages)) {
      throw new Error("The inventory variants response is invalid. Please refresh or contact support.");
    }
    return { rows: data.data, total: data.total, totalPages: data.total_pages,
      currentPage: data.current_page, fetchedAt: new Date().toISOString() };
  }, [allowed, search, page, perPage]);

  const refresh = () => { summary.reload(); list.reload(); };
  const searchInventory = (event) => { event.preventDefault(); setSearch(query.trim()); setPage(1); };
  const clearSearch = () => { setQuery(""); setSearch(""); setPage(1); };
  const s = summary.data;
  const result = list.data;
  const busy = summary.loading || list.loading;

  if (!allowed) return <ErrorState message="You need the manage inventory permission to view stock information." />;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Catalogue / Inventory"
        title="Inventory movements"
        subtitle="Current stock by product, colour and size. Read-only overview."
        actions={<div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Button href="/admin/inventory" variant="outline" size="sm">Inventory overview</Button>
          <Button variant="primary" size="sm" onClick={refresh} loading={busy}>
            <FiRefreshCw aria-hidden="true" /> Refresh stock
          </Button>
        </div>}
      />

      <div className="notice notice-info" role="note">
        <p><strong>Current stock, not movement history.</strong> The connected APIs return stock balances only. Receipts, deductions, adjustment reasons, movement dates and staff attribution are not available. No historical movements are inferred from these balances.</p>
      </div>

      {summary.loading ? <div className="stat-grid" aria-label="Loading inventory totals">
        {[1, 2, 3, 4].map(key => <Skeleton key={key} style={{ height: 110 }} />)}
      </div> : summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : s ? <>
        <div className="stat-grid">
          <Stat label="Total variants" value={quantity(s.total_variants)} icon={FiLayers} tone="info" />
          <Stat label="Units on hand" value={quantity(s.units_on_hand)} icon={FiBox} tone="brand" />
          <Stat label="Held units" value={quantity(s.units_reserved)} icon={FiBox} tone="warn" />
          <Stat label="Low-stock variants" value={quantity(s.low_stock)} icon={FiAlertTriangle} tone="warn" />
        </div>
        <p className="muted" style={{ fontSize: "0.82rem" }}>Totals cover the whole inventory, not only the search results. The summary API calls held units “units_reserved”.</p>
      </> : null}

      <Card>
        <form onSubmit={searchInventory} className="card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <Field label="Search stock" htmlFor="movement-stock-search">
              <Input id="movement-stock-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Product name, SKU or size" />
            </Field>
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={list.loading}><FiSearch aria-hidden="true" /> Search</Button>
          {(search || query) ? <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button> : null}
          <Field label="Rows per page" htmlFor="movement-stock-page-size">
            <Select id="movement-stock-page-size" value={perPage} onChange={event => { setPerPage(Number(event.target.value)); setPage(1); }} options={[20, 50, 100].map(value => ({ value, label: String(value) }))} />
          </Field>
        </form>

        {list.loading ? <div className="card-pad" role="status" aria-label="Loading stock variants"><Skeleton style={{ height: 280 }} /></div>
          : list.error ? <div className="card-pad"><ErrorState message={list.error} onRetry={list.reload} /></div>
          : !result || result.rows.length === 0 ? <EmptyState icon={FiBox}
            title={search ? "No stock variants match your search" : "No stock variants on this page"}
            text={search ? "Try another product name, SKU or size." : "The API returned no variants for this page."}
            action={search ? <Button variant="outline" onClick={clearSearch}>Clear search</Button> : page > 1 ? <Button variant="outline" onClick={() => setPage(1)}>Go to first page</Button> : null} />
          : <>
            <div className="card-pad row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between" }} aria-live="polite">
              <span className="muted">{quantity(result.total)} matching variant{result.total === 1 ? "" : "s"} · Page {result.currentPage} of {result.totalPages}</span>
              <span className="muted" style={{ fontSize: "0.82rem" }}>Fetched {formatDateTime(result.fetchedAt)}</span>
            </div>
            <DataTable>
              <thead><tr>
                <th>Product / SKU</th><th>Colour / size</th><th className="text-right">On hand</th>
                <th className="text-right">Reserved</th><th className="text-right">Held</th>
                <th className="text-right">Available</th><th>Stock status</th><th>Variant updated</th>
              </tr></thead>
              <tbody>{result.rows.map(variant => <tr key={variant.id}>
                <td><strong>{can("view products") && variant.product_id ? <Link href={`/admin/products/${variant.product_id}`}>{variant.product?.title || `Product #${variant.product_id}`}</Link> : variant.product?.title || "Product unavailable"}</strong>
                  <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>{variant.sku || variant.product?.sku || "No SKU"}</span></td>
                <td><span>{variant.color?.name || "No colour"} / {variant.size?.size || variant.label || "No size"}</span></td>
                <td className="text-right num">{quantity(variant.stock)}</td>
                <td className="text-right num">{quantity(variant.reserved)}</td>
                <td className="text-right num">{quantity(variant.held)}</td>
                <td className="text-right num"><strong>{quantity(variant.available)}</strong></td>
                <td><div className="chip-row">
                  {variant.product?.track_inventory ? <Badge tone={variant.available <= 0 ? "danger" : variant.low_stock ? "warn" : "success"}>{variant.available <= 0 ? "Out of stock" : variant.low_stock ? "Low stock" : "In stock"}</Badge> : <Badge>Not tracked</Badge>}
                  {variant.allow_preorder ? <Badge tone="info">Pre-order</Badge> : null}
                  {variant.is_active === false ? <Badge>Inactive</Badge> : null}
                </div></td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(variant.updated_at)}</td>
              </tr>)}</tbody>
            </DataTable>
            <div className="card-pad"><Pagination page={page} totalPages={result.totalPages} onChange={setPage} /></div>
          </>}
      </Card>
      <p className="muted" style={{ fontSize: "0.82rem" }}>Available quantities are used exactly as returned by the API (on hand minus held). Reserved and held are shown separately. “Variant updated” is not a stock-movement timestamp.</p>
    </div>
  );
}
