"use client";

import { useState } from "react";
import { FiDollarSign, FiShoppingBag, FiUsers, FiBox, FiTruck } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Select, Skeleton, Stat } from "@/components/ui";
import { api, formatMoney } from "@/lib/api";
import { orderStatusMeta, toDateInput } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

export default function SalesPage() {
  const [range, setRange] = useState({ start_date: toDateInput(monthStart), end_date: toDateInput(today), status: "", sort: "sales" });
  const [applied, setApplied] = useState(range);

  const { data, loading, error, reload } = useAsync(() => {
    const params = { start_date: applied.start_date, end_date: applied.end_date, sort: applied.sort };
    if (applied.status) params.status = applied.status;
    return api.get("api/admin/sales-report", { params }).then((b) => b.data);
  }, [applied]);

  const s = data?.summary;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Sales" title="Sales report" subtitle={data?.range ? `${data.range.from} → ${data.range.to} (${data.range.timezone})` : "Revenue and product performance."} />

      <form className="card card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); setApplied(range); }}>
        <Field label="From" htmlFor="sr-from"><Input id="sr-from" type="date" value={range.start_date} onChange={(e) => setRange({ ...range, start_date: e.target.value })} /></Field>
        <Field label="To" htmlFor="sr-to"><Input id="sr-to" type="date" value={range.end_date} onChange={(e) => setRange({ ...range, end_date: e.target.value })} /></Field>
        <Field label="Status" htmlFor="sr-status"><Select id="sr-status" placeholder="All orders" value={range.status} onChange={(e) => setRange({ ...range, status: e.target.value })} options={["pending", "confirmed", "processing", "shipped", "delivered"].map((v) => ({ value: v.toUpperCase(), label: orderStatusMeta(v).label }))} /></Field>
        <Field label="Sort products by" htmlFor="sr-sort"><Select id="sr-sort" value={range.sort} onChange={(e) => setRange({ ...range, sort: e.target.value })} options={[{ value: "sales", label: "Sales value" }, { value: "units", label: "Units sold" }]} /></Field>
        <Button type="submit" variant="primary">Run report</Button>
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
            {data.products.length === 0 ? <EmptyState icon={FiTruck} title="No product sales in this period" /> : (
              <DataTable>
                <thead><tr><th>Product</th><th className="text-right">Units</th><th className="text-right">Order lines</th><th className="text-right">Sales</th></tr></thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.product_id}><td><strong>{p.title}</strong></td><td className="text-right num">{p.quantity_sold}</td><td className="text-right num">{p.order_lines}</td><td className="text-right num">{formatMoney(p.sales)}</td></tr>
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
