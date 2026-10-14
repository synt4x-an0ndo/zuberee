"use client";

import Link from "next/link";
import { useState } from "react";
import { FiAlertCircle, FiBox, FiDollarSign, FiRefreshCw, FiShoppingBag, FiUsers } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Select, Skeleton, Stat } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { api, formatMoney } from "@/lib/api";
import { orderStatusMeta } from "@/lib/format";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

export default function DashboardPage() {
  const [range, setRange] = useState("month");
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useAsync(
    () => api.get("api/admin/dashboard/summary", { params: { range, status, hot_limit: 7 } }).then((b) => b.data),
    [range, status]
  );

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <AdminHeader
        eyebrow="Overview"
        title="Good to see you."
        subtitle="Here is what is happening across your store."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Link href="/admin/sales" className="btn btn-outline">Open sales report <span aria-hidden="true">→</span></Link>
            <button type="button" className="icon-btn" onClick={reload} aria-label="Refresh dashboard"><FiRefreshCw aria-hidden="true" /></button>
          </div>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <>
          <div className="stat-grid"><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 120 }} /></div>
          <Skeleton style={{ height: 260 }} />
        </>
      ) : (
        <>
          <div className="dashboard-filters">
            <div className="dashboard-range-tabs" role="tablist" aria-label="Dashboard date range">
              {RANGES.map((item) => (
                <button key={item.value} type="button" className={range === item.value ? "is-active" : ""} onClick={() => setRange(item.value)}>{item.label}</button>
              ))}
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[
              { value: "", label: "All order statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "CONFIRMED", label: "Confirmed" },
              { value: "PROCESSING", label: "Processing" },
              { value: "SHIPPED", label: "Shipped" },
              { value: "DELIVERED", label: "Delivered" },
              { value: "CANCELLED", label: "Cancelled" },
            ]} aria-label="Order status" style={{ minWidth: 170 }} />
          </div>
          <div className="stat-grid stagger">
            <Stat label="Gross sales" value={formatMoney(data.totals.gross_sales)} hint="New activity" icon={FiDollarSign} tone="brand" />
            <Stat label="Orders" value={data.totals.orders} hint="New activity" icon={FiBox} tone="info" />
            <Stat label="Units sold" value={data.totals.units_sold} hint="New activity" icon={FiShoppingBag} tone="success" />
            <Stat label="Customers" value={data.totals.customers} hint="New activity" icon={FiUsers} tone="warn" />
          </div>

          <div className="grid-2" style={{ alignItems: "start" }}>
            <Card>
              <CardHeader title="Sales trend" subtitle="Revenue movement" />
              <SalesChart points={data.sales_trend} />
            </Card>
            <Card>
              <CardHeader title="Status distribution" subtitle="Order pipeline" />
              {data.status_breakdown.length === 0 ? (
                <EmptyState title="No orders in this range" text="Try a wider date range." />
              ) : (
                <StatusChart rows={data.status_breakdown} />
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Top products"
              subtitle="Ranked by sales value"
              actions={<Link href="/admin/products" className="link-arrow">All products</Link>}
            />
            {data.top_products.length === 0 ? (
              <EmptyState icon={FiAlertCircle} title="No product sales yet" text="Sales for this range will appear here." />
            ) : (
              <ol className="rank-list">
                {data.top_products.map((p, i) => (
                  <li key={p.product_id}>
                    <span className="rank-no num">{i + 1}</span>
                    <span className="rank-name">{p.title}</span>
                    <span className="muted num">{p.quantity_sold} sold</span>
                    <span className="num" style={{ fontWeight: 700 }}>{formatMoney(p.sales)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function SalesChart({ points }) {
  if (!points.length) return <EmptyState title="No sales yet" text="Sales will chart here once orders come in." />;
  const max = Math.max(...points.map((p) => p.sales), 1);
  const width = 720;
  const height = 250;
  const padX = 18;
  const padY = 24;
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: padX + index * step,
    y: height - padY - (Number(point.sales || 0) / max) * (height - padY * 2),
    point,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;
  return (
    <div className="line-chart" role="img" aria-label={`Sales across ${points.length} days`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={height - padY - ratio * (height - padY * 2)} y2={height - padY - ratio * (height - padY * 2)} className="chart-gridline" />)}
        <polygon points={area} fill="url(#sales-area)" />
        <polyline points={line} className="chart-line" />
        {coords.map(({ x, y, point }) => <circle key={point.date} cx={x} cy={y} r="4" className="chart-point"><title>{`${point.date}: ${formatMoney(point.sales)} (${point.orders} orders)`}</title></circle>)}
      </svg>
      <div className="line-chart-axis">{points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 4) === 0).map((p) => <span key={p.date}>{p.date.slice(5)}</span>)}</div>
    </div>
  );
}

function StatusChart({ rows }) {
  const total = rows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
  let offset = 0;
  const colors = ["var(--brand)", "var(--brand-mid)", "#d99bcf", "#e2b7dc", "#a74bb0"];
  const segments = rows.map((row, index) => {
    const start = offset;
    offset += Number(row.percentage || 0);
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  });
  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ background: `conic-gradient(${segments.join(", ")})` }}>
        <div><strong>{total}</strong><span>orders</span></div>
      </div>
      <ul className="donut-legend">
        {rows.map((row, index) => {
          const meta = orderStatusMeta(row.status);
          return <li key={row.status}><span className="legend-dot" style={{ background: colors[index % colors.length] }} /><span>{meta.label}</span><strong>{row.percentage}%</strong></li>;
        })}
      </ul>
    </div>
  );
}
