"use client";

import { useState } from "react";
import { FiDollarSign, FiShoppingBag, FiUsers, FiBox, FiTruck, FiDownload } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Select, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, formatMoney } from "@/lib/api";
import { formatDate, orderStatusMeta, toDateInput } from "@/lib/format";
import { downloadSalesReportPdf } from "@/lib/salesReportPdf";
import { useAsync } from "@/lib/useAsync";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

const PRODUCT_STATUS_META = {
  "in-stock": { label: "In stock", tone: "success" },
  "out-of-stock": { label: "Out of stock", tone: "danger" },
  "pre-order": { label: "Pre-order", tone: "info" },
  "sold-out": { label: "Sold out", tone: "neutral" },
};

function productStatusMeta(status) {
  const key = String(status || "").toLowerCase().replaceAll("_", "-");
  if (PRODUCT_STATUS_META[key]) return PRODUCT_STATUS_META[key];
  if (!key) return null;
  return {
    label: key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: "neutral",
  };
}

export default function SalesPage() {
  const { toast } = useFeedback();
  const { siteName, primaryColor, company } = useSite();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [range, setRange] = useState({ start_date: toDateInput(monthStart), end_date: toDateInput(today), status: "", product: "", sort: "sales" });
  const [applied, setApplied] = useState(range);

  const { data, loading, error, reload } = useAsync(() => {
    // The API sorts by "revenue" / "quantity"; the UI labels stay merchant-friendly.
    const params = { start_date: applied.start_date, end_date: applied.end_date, sort: applied.sort === "units" ? "quantity" : "revenue" };
    if (applied.status) params.status = applied.status;
    if (applied.product?.trim()) params.product = applied.product.trim();
    return api.get("api/admin/sales-report", { params }).then((b) => b.data);
  }, [applied]);

  const s = data?.summary;
  // Normalise both backend field names (gross_sales / order_count) and the
  // legacy ones (sales / order_lines) so the table and the PDF always agree.
  const products = (data?.products || []).map((p) => {
    const units = p.quantity_sold ?? p.units_sold ?? p.quantity ?? p.units ?? 0;
    const sales = p.gross_sales ?? p.sales ?? p.revenue ?? 0;
    return {
      ...p,
      title: p.title || p.name || "Untitled product",
      status: p.product_status ?? p.status ?? null,
      units,
      orders: p.order_count ?? p.order_lines ?? p.orders ?? 0,
      customers: p.customer_count ?? p.customers ?? 0,
      avgUnitPrice: p.average_unit_price ?? p.avg_unit_price ?? (units > 0 ? sales / units : 0),
      sales,
      lastOrderedAt: p.last_ordered_at ?? p.lastOrderedAt ?? null,
    };
  });

  const handleDownloadPdf = async () => {
    if (!data || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const filename = await downloadSalesReportPdf({
        report: data,
        siteName: siteName || "Store",
        primaryColor,
        company,
        filters: {
          statusLabel: applied.status ? orderStatusMeta(applied.status).label : "All statuses",
          product: applied.product?.trim() || "",
          sortLabel: applied.sort === "units" ? "Units sold" : "Sales value",
        },
      });
      toast.success(`Sales report downloaded (${filename}).`);
    } catch (pdfError) {
      console.error("Sales report PDF failed:", pdfError);
      toast.error("The PDF could not be generated. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Sales"
        title="Sales report"
        subtitle={data?.range ? `${data.range.from} → ${data.range.to} (${data.range.timezone})` : "Revenue and product performance."}
        actions={(
          <Button
            type="button"
            variant="primary"
            icon={FiDownload}
            loading={downloadingPdf}
            disabled={loading || !data || Boolean(error)}
            onClick={handleDownloadPdf}
            title="Download a print-ready PDF of the currently applied report"
          >
            {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
          </Button>
        )}
      />

      <form className="card card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); setApplied(range); }}>
        <Field label="From" htmlFor="sr-from"><Input id="sr-from" type="date" value={range.start_date} onChange={(e) => setRange({ ...range, start_date: e.target.value })} /></Field>
        <Field label="To" htmlFor="sr-to"><Input id="sr-to" type="date" value={range.end_date} onChange={(e) => setRange({ ...range, end_date: e.target.value })} /></Field>
        <Field label="Status" htmlFor="sr-status"><Select id="sr-status" placeholder="All statuses" value={range.status} onChange={(e) => setRange({ ...range, status: e.target.value })} options={["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((v) => ({ value: v.toUpperCase(), label: orderStatusMeta(v).label }))} /></Field>
        <Field label="Find product" htmlFor="sr-product"><Input id="sr-product" type="search" placeholder="Name or SKU" value={range.product} onChange={(e) => setRange({ ...range, product: e.target.value })} /></Field>
        <Field label="Sort products by" htmlFor="sr-sort"><Select id="sr-sort" value={range.sort} onChange={(e) => setRange({ ...range, sort: e.target.value })} options={[{ value: "sales", label: "Sales value" }, { value: "units", label: "Units sold" }]} /></Field>
        <Button type="submit" variant="primary">Run report</Button>
        <Button type="button" variant="outline" icon={FiDownload} loading={downloadingPdf} disabled={loading || !data || Boolean(error)} onClick={handleDownloadPdf}>Download PDF</Button>
      </form>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? (
        <div className="stat-grid"><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /></div>
      ) : (
        <>
          <div className="stat-grid stagger">
            <Stat label="Gross sales" value={formatMoney(s.gross_sales)} icon={FiDollarSign} tone="brand" />
            <Stat label="Orders" value={s.orders} icon={FiShoppingBag} tone="info" />
            <Stat label="Units sold" value={s.units_sold} icon={FiBox} tone="success" />
            <Stat label="Avg. order" value={formatMoney(s.average_order_value)} icon={FiUsers} tone="warn" />
          </div>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Customers: {s.customers} · Shipping collected: {formatMoney(s.shipping_collected)} · Products ordered: {s.products_ordered}
          </p>

          <div className="grid-2" style={{ alignItems: "start" }}>
            <Card>
              <CardHeader title="Daily sales" />
              {data.daily_sales.length === 0 ? <EmptyState title="No sales in this period" /> : (
                <DataTable>
                  <thead><tr><th>Date</th><th className="text-right">Orders</th><th className="text-right">Customers</th><th className="text-right">Sales</th></tr></thead>
                  <tbody>
                    {data.daily_sales.map((d) => (
                      <tr key={d.date}><td className="num">{d.date}</td><td className="text-right num">{d.orders}</td><td className="text-right num">{d.customers}</td><td className="text-right num">{formatMoney(d.sales)}</td></tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
            <Card>
              <CardHeader title="Order status" />
              {data.status_breakdown.length === 0 ? <EmptyState title="No orders" /> : (
                <ul className="status-list">
                  {data.status_breakdown.map((row) => {
                    const meta = orderStatusMeta(row.status);
                    return <li key={row.status}><Badge tone={meta.tone}>{meta.label}</Badge><span className="num">{row.orders} orders</span></li>;
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card className="card-flush sales-product-details-card">
            <div className="sales-product-details-head">
              <div>
                <p className="eyebrow">Complete catalog</p>
                <h2 className="card-title sales-product-details-title">Product sales details</h2>
                <p className="card-subtitle">
                  {products.length} {products.length === 1 ? "product" : "products"} shown · Sorted by {applied.sort === "units" ? "units sold" : "sales value"}
                </p>
              </div>
              <dl className="sales-product-details-metrics" aria-label="Product sales summary">
                <div>
                  <dt>Avg. order</dt>
                  <dd>{formatMoney(s.average_order_value)}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>{formatMoney(s.shipping_collected)}</dd>
                </div>
              </dl>
            </div>

            {products.length === 0 ? (
              <div className="sales-product-details-empty">
                <EmptyState icon={FiTruck} title={applied.product ? "No products match your search" : "No products in catalog"} />
              </div>
            ) : (
              <DataTable className="sales-product-details-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Status</th>
                    <th className="text-right">Times ordered</th>
                    <th className="text-right">Units sold</th>
                    <th className="text-right">Customers</th>
                    <th className="text-right">Avg. unit price</th>
                    <th className="text-right">Gross sales</th>
                    <th className="text-right">Last ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const status = productStatusMeta(p.status);
                    return (
                      <tr key={p.product_id ?? p.id ?? p.title}>
                        <td>
                          <div className="sales-product-name">
                            <strong>{p.title}</strong>
                            {p.sku ? <span className="muted sales-product-sku">SKU: {p.sku}</span> : null}
                          </div>
                        </td>
                        <td>{status ? <Badge tone={status.tone}>{status.label}</Badge> : <span className="muted">—</span>}</td>
                        <td className="text-right num">{p.orders}</td>
                        <td className="text-right num">{p.units}</td>
                        <td className="text-right num">{p.customers}</td>
                        <td className="text-right num">{formatMoney(p.avgUnitPrice)}</td>
                        <td className="text-right num"><strong>{formatMoney(p.sales)}</strong></td>
                        <td className="text-right num">{formatDate(p.lastOrderedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
