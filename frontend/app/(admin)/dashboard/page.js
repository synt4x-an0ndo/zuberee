"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaArrowTrendUp, FaReceipt, FaBoxOpen, FaUsers } from "react-icons/fa6";
import { api, formatTk } from "@/lib/api";
import PageGate from "@/components/admin/PageGate";

import "@/styles/css/2c43b43766746233.css";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const STATUS_OPTIONS = [
  "",
  "pending",
  "placed",
  "processing",
  "completed",
  "cancelled",
  "returned",
  "order_confirmed",
];
const STATUS_LABELS = {
  "": "All order statuses",
  pending: "Pending",
  placed: "Placed",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  returned: "Returned",
  order_confirmed: "Order Confirmed",
};

function prettyStatus(s) {
  return String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ChangeBadge({ value }) {
  if (value == null || value === 0)
    return <span className="dashboard_newActivity__ZBFa4">New activity</span>;
  const up = value > 0;
  return (
    <span className={up ? "dashboard_positive__FfeFx" : "dashboard_negative__Fpyhh"}>
      {up ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */
function Summary() {
  const [range, setRange] = useState("month");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams({ range, hot_limit: "7" });
    if (status) p.set("status", status);
    if (range === "custom" && startDate && endDate) {
      p.set("start_date", startDate);
      p.set("end_date", endDate);
    }
    return p.toString();
  }, [range, status, startDate, endDate]);

  useEffect(() => {
    if (range === "custom" && (!startDate || !endDate)) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await api.get(`api/dashboard/summary?${qs}`);
        if (alive) setData(r);
      } catch (e) {
        if (alive) setError(e.message || "The dashboard data could not be loaded.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [qs, range, startDate, endDate]);

  const totals = data?.totals || {};
  const changes = data?.changes || {};
  const trend = data?.sales_trend || [];
  const breakdown = data?.status_breakdown || [];
  const topProducts = data?.top_products || [];

  const cards = [
    { title: "Gross sales", value: `৳${formatTk(totals.gross_sales)}`, change: changes.gross_sales, icon: <FaArrowTrendUp /> },
    { title: "Orders", value: formatTk(totals.orders), change: changes.orders, icon: <FaReceipt /> },
    { title: "Units sold", value: formatTk(totals.units_sold), change: changes.units_sold, icon: <FaBoxOpen /> },
    { title: "Customers", value: formatTk(totals.customers), change: changes.customers, icon: <FaUsers /> },
  ];

  /* chart geometry */
  const chart = useMemo(() => {
    if (!trend.length) return null;
    const W = 820, H = 250, padL = 20, padR = 20, padT = 18, padB = 32;
    const max = Math.max(...trend.map((t) => Number(t.sales) || 0), 1);
    const step = (W - padL - padR) / Math.max(trend.length - 1, 1);
    const pts = trend.map((t, i) => ({
      x: padL + i * step,
      y: padT + (H - padT - padB) * (1 - (Number(t.sales) || 0) / max),
      date: t.date,
      sales: Number(t.sales) || 0,
    }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const area = `${line} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;
    return { pts, line, area, W, H };
  }, [trend]);

  const donutTotal = breakdown.reduce((s, b) => s + (b.orders || 0), 0);
  const donutColors = ["#741478", "#b743a6", "#e399c9", "#53245b", "#d7bfd9", "#8c6c91"];
  const donutBg = (() => {
    if (!donutTotal) return "#eee9ef";
    let acc = 0;
    const stops = breakdown.slice(0, 6).map((b, i) => {
      const start = acc;
      acc += ((b.orders || 0) / donutTotal) * 100;
      return `${donutColors[i % donutColors.length]} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(",")})`;
  })();

  return (
    <div className="dashboard_page__TZrNk">
      {/* header */}
      <div className="dashboard_header__IYRHh">
        <div>
          <h4 className="mb-1 fw-bold">Business overview</h4>
          <p className="mb-0 text-muted">
            <strong>Good to see you.</strong> Here is what is happening across Eyara
            Fashion.
          </p>
        </div>
        <div className="dashboard_headerActions__X_MoQ">
          <Link href="/dashboard/sales-report" className="btn btn-sm btn-grad">
            Open sales report
          </Link>
        </div>
      </div>

      {/* filter bar */}
      <div className="dashboard_filterBar__cueum">
        <div className="dashboard_rangeTabs__IPP2g">
          {["today", "week", "month", "year", "custom"].map((r) => (
            <button
              key={r}
              className={range === r ? "dashboard_active__5uIRg" : ""}
              onClick={() => setRange(r)}
              type="button"
            >
              {r === "custom"
                ? "Custom"
                : r === "today"
                  ? "Today"
                  : r === "week"
                    ? "This week"
                    : r === "month"
                      ? "This month"
                      : "This year"}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="dashboard_dates__zvumm">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}

        <select
          className="form-select form-select-sm w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="dashboard_error__7IDG0">{error}</div>}
      {loading && (
        <div className="dashboard_loading__zctVA">
          <span className="spinner-border dashboard_spin__DTCTM" />
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* stat cards */}
          <div className="dashboard_cards__TYQD6">
            {cards.map((c) => (
              <div key={c.title} className="dashboard_card__yGBr4">
                <div className="dashboard_cardTop__rp1OP">
                  <span>{c.title}</span>
                  <i>{c.icon}</i>
                </div>
                <strong>{c.value}</strong>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <ChangeBadge value={c.change} />
                  <small className="text-muted">vs previous period</small>
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard_grid__uxJ2l">
            {/* sales trend */}
            <div className="dashboard_salesPanel__ddi5Y dashboard_panel__OCvi8">
              <div className="dashboard_panelHead__315K0">
                <div>
                  <strong>Revenue movement</strong>
                  <small className="d-block text-muted">Sales trend</small>
                </div>
                <div className="dashboard_aov__r3aA6">
                  Average order{" "}
                  <b>৳{formatTk(totals.average_order_value)}</b>
                </div>
              </div>
              {chart ? (
                <div className="dashboard_chartWrap__oeE1d">
                  <svg viewBox={`0 0 ${chart.W} ${chart.H}`} role="img" aria-label="Sales trend">
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9b2b9c" stopOpacity="0.28" />
                        <stop offset="10%" stopColor="#9b2b9c" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0, 1, 2, 3].map((i) => (
                      <line key={i} x1={20} x2={800} y1={18 + 56 * i} y2={18 + 56 * i} stroke="#eee8ef" strokeWidth="1" />
                    ))}
                    <path d={chart.area} fill="url(#salesFill)" />
                    <path d={chart.line} fill="none" stroke="#78167e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                    {chart.pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#78167e" strokeWidth="3">
                        <title>{`${p.date}: ৳${p.sales}`}</title>
                      </circle>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="dashboard_emptyChart__DFult">
                  Sales activity will appear here.
                </div>
              )}
            </div>

            {/* order pipeline */}
            <div className="dashboard_panel__OCvi8">
              <div className="dashboard_panelHead__315K0">
                <div>
                  <strong>Order pipeline</strong>
                  <small className="d-block text-muted">Status distribution</small>
                </div>
              </div>
              {breakdown.length ? (
                <div className="dashboard_donutLayout__TtkpE">
                  <div className="dashboard_donut__Dp3S4" style={{ background: donutBg }}>
                    <div>
                      <strong>{donutTotal}</strong>
                      <span>orders</span>
                    </div>
                  </div>
                  <div className="dashboard_legend__mKrpd">
                    {breakdown.slice(0, 6).map((b, i) => (
                      <div key={b.status}>
                        <i style={{ background: donutColors[i % donutColors.length] }} />
                        <span>{prettyStatus(b.status)}</span>
                        <strong>{b.percentage}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="dashboard_empty__iTzWl">0 orders</div>
              )}
            </div>

            {/* top products */}
            <div className="dashboard_productsPanel__dSLfX dashboard_panel__OCvi8">
              <div className="dashboard_panelHead__315K0">
                <div>
                  <strong>Product momentum</strong>
                  <small className="d-block text-muted">Top-selling products</small>
                </div>
                <Link href="/dashboard/sales-report" className="small">
                  View full report
                </Link>
              </div>
              {topProducts.length ? (
                <div className="dashboard_productList__33bco">
                  {topProducts.slice(0, 7).map((p, i) => (
                    <div key={p.product_id ?? i} className="d-flex align-items-center gap-2 py-2 border-bottom">
                      <span className="dashboard_rank__XNmCw">{i + 1}</span>
                      <div className="flex-fill" style={{ minWidth: 0 }}>
                        <div className="small text-truncate">{p.title}</div>
                        <small className="text-muted">{p.sku}</small>
                      </div>
                      <div className="text-end small">
                        <b>{p.order_count}</b> orders
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {p.customer_count} customers
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard_empty__iTzWl">
                  No product sales in this period.
                </div>
              )}
            </div>

            {/* snapshot */}
            <div className="dashboard_panel__OCvi8">
              <div className="dashboard_panelHead__315K0">
                <div>
                  <strong>At a glance</strong>
                  <small className="d-block text-muted">Sales snapshot</small>
                </div>
              </div>
              <div className="dashboard_snapshot__mFCzV">
                <div>
                  <span>Shipping collected</span>
                  <b>৳{formatTk(totals.shipping_collected)}</b>
                </div>
                <div>
                  <span>Average units per order</span>
                  <b>
                    {totals.orders
                      ? (totals.units_sold / totals.orders).toFixed(1)
                      : "0.0"}
                  </b>
                </div>
                <div>
                  <span>Orders per customer</span>
                  <b>
                    {totals.customers
                      ? (totals.orders / totals.customers).toFixed(1)
                      : "0.0"}
                  </b>
                </div>
                <Link href="/dashboard/orders" className="btn btn-grad btn-sm mt-2">
                  Manage orders →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageGate permission="view dashboard summary">
      <Summary />
    </PageGate>
  );
}
