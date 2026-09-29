"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatTk } from "@/lib/api";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";
import { ORDER_STATUSES } from "@/lib/orderStatuses";

import "@/styles/css/0f46ebbf2f2136d2.css";

/**
 * Sales report (/dashboard/sales-report)
 *  - GET api/sales-report?from=&to=&status=&search=&sort=revenue
 *    -> { summary:{gross_sales,orders,units_sold,customers,average_order_value,shipping_collected},
 *         products:[{product_id,title,sku,product_status,quantity_sold,order_count,
 *                    customer_count,average_unit_price,gross_sales,last_ordered_at}],
 *         status_breakdown:[{status,sales,orders}] }
 */
function SalesReport() {
  const [filters, setFilters] = useState({ from: "", to: "", status: "", search: "" });
  const [applied, setApplied] = useState({ from: "", to: "", status: "", search: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => v && p.set(k, v));
      p.set("sort", "revenue");
      const r = await api.get(`api/sales-report?${p.toString()}`);
      setData(r);
    } catch (e) {
      setError(e.message || "Could not load the sales report.");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const products = (data?.products || []).filter((p) => p.quantity_sold > 0);
  const breakdown = data?.status_breakdown || [];
  const maxQty = Math.max(...products.slice(0, 7).map((p) => p.quantity_sold), 1);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const downloadPdf = () => {
    // Print-friendly export via browser (same as original "Download PDF")
    window.print();
  };

  if (loading && !data) return <Loader />;

  return (
    <div className="sales-page">
      <div className="hero">
        <div>
          <span className="eyebrow">Commerce intelligence</span>
          <h4 className="fw-bold mb-0">Sales report</h4>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={downloadPdf}>
          Download PDF
        </button>
      </div>

      {/* filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3 d-flex gap-2 flex-wrap align-items-end">
          <div>
            <label className="form-label small mb-1">From</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filters.from}
              onChange={(e) => set("from", e.target.value)}
            />
          </div>
          <div>
            <label className="form-label small mb-1">To</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filters.to}
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
          <div>
            <label className="form-label small mb-1">Order status</label>
            <select
              className="form-select form-select-sm"
              value={filters.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Find product</label>
            <input
              className="form-control form-control-sm"
              placeholder="Product name / SKU"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
            />
          </div>
          <button
            className="btn btn-grad btn-sm"
            disabled={loading}
            onClick={() => setApplied({ ...filters })}
          >
            {loading ? "Loading..." : "Apply report"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          {/* summary cards */}
          <div className="row g-3 mb-3">
            <SummaryCard label="Gross sales" value={`${formatTk(summary.gross_sales)}৳`} />
            <SummaryCard label="Orders" value={summary.orders ?? 0} />
            <SummaryCard label="Units sold" value={summary.units_sold ?? 0} />
            <SummaryCard label="Customers" value={summary.customers ?? 0} />
            <SummaryCard
              label="Avg. order value"
              value={`${formatTk(summary.average_order_value)}৳`}
            />
            <SummaryCard
              label="Shipping collected"
              value={`${formatTk(summary.shipping_collected)}৳`}
            />
          </div>

          <div className="row g-3 mb-3">
            {/* product performance */}
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-bold">
                  Best-selling products — Product sales details
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Product</th>
                          <th>Status</th>
                          <th>Times ordered</th>
                          <th>Customers</th>
                          <th>Avg. unit price</th>
                          <th>Gross sales</th>
                          <th>Last ordered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-4 text-muted">
                              No product sales in this period.
                            </td>
                          </tr>
                        ) : (
                          products.map((p) => (
                            <tr key={p.product_id ?? p.title}>
                              <td>
                                <div className="fw-semibold">{p.title}</div>
                                <small className="text-muted">{p.sku}</small>
                                <div
                                  className="rounded"
                                  style={{
                                    height: 6,
                                    width: `${Math.round(
                                      ((p.quantity_sold || 0) / maxQty) * 100
                                    )}%`,
                                    background: "#7d0ba7",
                                    marginTop: 4,
                                  }}
                                />
                              </td>
                              <td>
                                <span className="badge bg-secondary">{p.product_status}</span>
                              </td>
                              <td>{p.order_count}</td>
                              <td>{p.customer_count}</td>
                              <td>{formatTk(p.average_unit_price)}৳</td>
                              <td className="fw-semibold">{formatTk(p.gross_sales)}৳</td>
                              <td>
                                <small>
                                  {p.last_ordered_at
                                    ? new Date(p.last_ordered_at).toLocaleDateString(
                                        "en-GB",
                                        { timeZone: "Asia/Dhaka" }
                                      )
                                    : "—"}
                                </small>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* order health */}
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-bold">Order health — Status mix</div>
                <div className="card-body">
                  {breakdown.length === 0 ? (
                    <p className="text-muted mb-0">No orders in this period.</p>
                  ) : (
                    breakdown.map((b) => (
                      <div
                        key={b.status}
                        className="d-flex justify-content-between align-items-center mb-2"
                      >
                        <span>
                          <span
                            className="badge me-2"
                            style={{ background: "#7d0ba7" }}
                          />
                          {b.status}
                          <small className="text-muted ms-2">
                            ৳{formatTk(b.sales)}
                          </small>
                        </span>
                        <strong>{b.orders}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="col-6 col-md-4 col-xl-2">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body py-3">
          <div className="text-muted small">{label}</div>
          <div className="fw-bold fs-5">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function SalesReportPage() {
  return (
    <PageGate permission="view orders">
      <SalesReport />
    </PageGate>
  );
}
