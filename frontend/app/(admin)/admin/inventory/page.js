"use client";

import Link from "next/link";
import { useState } from "react";
import { FiBox, FiAlertTriangle, FiLayers, FiSearch } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, EmptyState, ErrorState, Input, Pagination, Select, Skeleton, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

const FILTERS = [
  { value: "all", label: "All variants" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "preorder", label: "Pre-order" },
  { value: "tracked", label: "Tracked only" },
];

export default function InventoryPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const summary = useAsync(() => api.get("api/admin/inventory/summary").then((b) => b.data), []);
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

  const s = summary.data;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Catalogue" title="Inventory" subtitle="Stock on hand for every product size and colour." />

      {summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : !s ? (
        <div className="stat-grid"><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /></div>
      ) : (
        <div className="stat-grid stagger">
          <Stat label="Tracked products" value={s.tracked_products ?? 0} icon={FiBox} tone="brand" />
          <Stat label="Variants" value={s.total_variants ?? 0} icon={FiLayers} tone="info" />
          <Stat label="Units on hand" value={s.units_on_hand ?? 0} icon={FiBox} tone="success" />
        </div>
      )}

      <div className="card card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
          <Input aria-label="Search inventory" placeholder="Search by product, SKU or colour" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 36 }} />
        </div>
        <Select aria-label="Filter inventory" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} options={FILTERS} style={{ flex: "0 1 200px" }} />
      </div>

      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data ? <Skeleton style={{ height: 360 }} /> : list.data.rows.length === 0 ? (
        <EmptyState icon={FiAlertTriangle} title="No variants match" text="Try another filter or search term." />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Reserved</th>
                <th className="text-right">Available</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.product?.id ? <Link href={`/admin/products/${v.product.id}`}><strong>{v.product.title || "Product"}</strong></Link> : <strong>Product</strong>}
                    {v.sku && <span className="muted num" style={{ display: "block", fontSize: "0.82rem" }}>{v.sku}</span>}
                  </td>
                  <td className="muted">{v.label || "—"}</td>
                  <td className="text-right num">{v.stock}</td>
                  <td className="text-right num">{(v.reserved ?? 0) + (v.held ?? 0)}</td>
                  <td className="text-right num" style={{ fontWeight: 700, color: v.available <= 0 ? "var(--danger)" : undefined }}>{v.available}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {v.low_stock && <Badge tone="warn">Low</Badge>}
                      {v.allow_preorder && <Badge tone="info">Pre-order</Badge>}
                      {v.is_active === false && <Badge tone="neutral">Inactive</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={list.data.meta.current_page || page} totalPages={list.data.meta.total_pages || 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}
