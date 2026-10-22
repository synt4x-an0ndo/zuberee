"use client";

import Link from "next/link";
import { useState } from "react";
import { FiAlertCircle, FiBox, FiDollarSign, FiRefreshCw, FiShoppingBag, FiUsers } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import SalesTrendChart from "@/components/admin/SalesTrendChart";
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
            <Card className="sales-trend-card">
              <CardHeader title="Sales trend" subtitle="Revenue movement" />
              <SalesTrendChart points={data.sales_trend} />
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

function StatusChart({ rows }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const total = rows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
  const colors = ["var(--brand)", "var(--brand-mid)", "#d99bcf", "#e2b7dc", "#a74bb0", "#8a6bc9"];
  const GAP = rows.length > 1 ? 1.4 : 0;

  const segments = rows.reduce(
    (acc, row, index) => {
      const orders = Number(row.orders || 0);
      const pct = total > 0 ? (orders / total) * 100 : 0;
      const drawn = pct <= 0 ? 0 : pct <= GAP ? pct * 0.6 : pct - GAP;
      const segment = {
        key: row.status || `status-${index}`,
        label: orderStatusMeta(row.status).label,
        orders,
        pct,
        start: acc.offset,
        drawn,
        color: colors[index % colors.length],
      };
      return { offset: acc.offset + pct, items: [...acc.items, segment] };
    },
    { offset: 0, items: [] }
  ).items;

  const active = activeIndex != null ? segments[activeIndex] : null;

  return (
    <div className="donut-layout">
      <div className="donut-chart">
        <svg viewBox="0 0 200 200" className="donut-ring" role="img" aria-label={`Order status distribution, ${total} orders`} focusable="false">
          <circle cx="100" cy="100" r="80" className="donut-track" />
          {segments.map((segment, index) => (
            <circle
              key={segment.key}
              cx="100"
              cy="100"
              r="80"
              pathLength={100}
              stroke={segment.color}
              strokeDasharray={`${segment.drawn} ${Math.max(0, 100 - segment.drawn)}`}
              strokeDashoffset={-segment.start}
              transform="rotate(-90 100 100)"
              className={`donut-seg${activeIndex === index ? " is-active" : ""}${activeIndex != null && activeIndex !== index ? " is-dim" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          ))}
        </svg>
        <div className="donut-center">
          <strong>{active ? active.orders : total}</strong>
          <span style={active ? { color: active.color, fontWeight: 700 } : undefined}>{active ? active.label : "orders"}</span>
          {active && <small>{Math.round(active.pct)}% of orders</small>}
        </div>
      </div>
      <ul className="donut-legend">
        {segments.map((segment, index) => (
          <li key={segment.key}>
            <button
              type="button"
              className={`donut-legend-row${activeIndex === index ? " is-active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(activeIndex === index ? null : index)}
            >
              <span className="legend-dot" style={{ background: segment.color }} />
              <span className="donut-legend-label">{segment.label}</span>
              <span className="donut-legend-values">
                <span className="donut-legend-count">{segment.orders}</span>
                <strong>{Math.round(segment.pct)}%</strong>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
