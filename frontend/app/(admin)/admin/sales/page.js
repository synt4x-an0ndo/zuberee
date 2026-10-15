"use client";

import { useState } from "react";
import { FiDollarSign, FiShoppingBag, FiUsers, FiBox, FiTruck, FiDownload } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Select, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, formatMoney } from "@/lib/api";
import { orderStatusMeta, toDateInput } from "@/lib/format";
import { downloadSalesReportPdf } from "@/lib/salesReportPdf";
import { useAsync } from "@/lib/useAsync";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

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
  const products = (data?.products || []).map((p) => ({
    ...p,
    units: p.quantity_sold ?? p.units_sold ?? p.quantity ?? p.units ?? 0,
    orders: p.order_count ?? p.order_lines ?? p.orders ?? 0,
    sales: p.gross_sales ?? p.sales ?? p.revenue ?? 0,
  }));

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

          <Card>
            <CardHeader title="Products" subtitle={`Sorted by ${applied.sort === "units" ? "units sold" : "sales value"}`} />
            {products.length === 0 ? <EmptyState icon={FiTruck} title="No product sales in this period" /> : (
              <DataTable>
                <thead><tr><th>Product</th><th className="text-right">Units</th><th className="text-right">Orders</th><th className="text-right">Sales</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.product_id ?? p.id ?? p.title}><td><strong>{p.title}</strong>{p.sku ? <span className="muted"> · {p.sku}</span> : null}</td><td className="text-right num">{p.units}</td><td className="text-right num">{p.orders}</td><td className="text-right num">{formatMoney(p.sales)}</td></tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
