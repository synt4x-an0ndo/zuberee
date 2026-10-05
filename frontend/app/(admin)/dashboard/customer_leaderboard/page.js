"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatTk } from "@/lib/api";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Customer leaderboard (/dashboard/customer_leaderboard)
 *  - GET api/customers/statistics
 *      -> {success, data:{total_customers,new_customers,repeat_customers,
 *                         total_revenue,average_order_value,percentage}}
 *  - GET api/customers/leaderboard?page=&search=&district=&order_count_sort=
 *        &total_spent_sort=&date_from=&date_to=&per_page=15|25|50|100
 *      -> {data:[{name,phone,email,district,address,badge,total_orders,
 *                 total_spent,last_order_date,average_order_value,...}],
 *          current_page,last_page}
 */
function Leaderboard() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    district: "",
    order_count_sort: "",
    total_spent_sort: "",
    date_from: "",
    date_to: "",
    per_page: "15",
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/customers/statistics");
        if (r?.success) setStats(r.data);
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page) });
      Object.entries(filters).forEach(([k, v]) => v && p.append(k, v));
      const r = await api.get(`api/customers/leaderboard?${p.toString()}`);
      const rows = r?.data?.data ?? r?.data;
      setRows(Array.isArray(rows) ? rows : []);
      setPager({
        current_page: r?.data?.current_page || 1,
        last_page: r?.data?.last_page || 1,
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const repeatRate =
    stats && stats.total_customers
      ? ((stats.repeat_customers / stats.total_customers) * 100).toFixed(1)
      : null;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0 fw-bold">Customer Leaderboard</h2>
      </div>

      {/* insights header */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-8 d-flex align-items-center gap-3">
              <div
                style={{
                  background: "rgba(59,130,246,0.1)",
                  width: 48,
                  height: 48,
                }}
                className="rounded-circle d-flex align-items-center justify-content-center"
              >
                ★
              </div>
              <div>
                <h5 className="fw-bold mb-0">Customer Insights</h5>
                <small className="text-muted">Your business performance overview</small>
              </div>
            </div>
            <div className="col-md-4 text-md-end mt-3 mt-md-0">
              <small className="text-muted">Repeat Rate</small>
              <h5 className="fw-bold text-success mt-1">
                {repeatRate != null ? `${repeatRate}%` : "—"}
              </h5>
            </div>
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="row g-3 mb-4">
        {stats ? (
          <>
            <StatCard label="Total Customers" value={stats.total_customers} />
            <StatCard label="New Customers" value={stats.new_customers} />
            <StatCard label="Repeat Customers" value={stats.repeat_customers} />
            <StatCard
              label="Total Revenue"
              value={`${formatTk(stats.total_revenue)}৳`}
            />
            <StatCard
              label="Avg. Order Value"
              value={`${formatTk(stats.average_order_value)}৳`}
            />
            <StatCard
              label="vs last month"
              value={
                stats.percentage != null
                  ? `${stats.trend === "down" ? "↓" : "↑"} ${stats.percentage}%`
                  : "—"
              }
            />
          </>
        ) : (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="col-lg-2 col-md-4 col-sm-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="placeholder-glow">
                    <div className="placeholder col-8 mb-2" />
                    <div className="placeholder col-5" />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-white fw-bold">Filter &amp; Sort Customers</div>
        <div className="card-body py-3 d-flex gap-2 flex-wrap align-items-end">
          <input
            className="form-control w-auto"
            style={{ maxWidth: 220 }}
            placeholder="Search name / phone"
            value={filters.search}
            onChange={(e) => {
              setPage(1);
              set("search", e.target.value);
            }}
          />
          <select
            className="form-select w-auto"
            value={filters.district}
            onChange={(e) => {
              setPage(1);
              set("district", e.target.value);
            }}
          >
            <option value="">All districts</option>
            <option value="dhaka">Dhaka</option>
            <option value="chittagong">Chittagong</option>
            <option value="khulna">Khulna</option>
            <option value="sylhet">Sylhet</option>
            <option value="rajshahi">Rajshahi</option>
            <option value="barishal">Barishal</option>
            <option value="rangpur">Rangpur</option>
            <option value="mymensingh">Mymensingh</option>
          </select>
          <select
            className="form-select w-auto"
            value={filters.order_count_sort}
            onChange={(e) => {
              setPage(1);
              set("order_count_sort", e.target.value);
            }}
          >
            <option value="">📈 Most Orders First</option>
            <option value="desc">Most orders (desc)</option>
            <option value="asc">📉 Least Orders First</option>
          </select>
          <select
            className="form-select w-auto"
            value={filters.total_spent_sort}
            onChange={(e) => {
              setPage(1);
              set("total_spent_sort", e.target.value);
            }}
          >
            <option value="">💰 Highest Spent First</option>
            <option value="desc">Highest spent (desc)</option>
            <option value="asc">💸 Lowest Spent First</option>
          </select>
          <input
            type="date"
            className="form-control form-control-sm w-auto"
            value={filters.date_from}
            onChange={(e) => {
              setPage(1);
              set("date_from", e.target.value);
            }}
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            className="form-control form-control-sm w-auto"
            value={filters.date_to}
            onChange={(e) => {
              setPage(1);
              set("date_to", e.target.value);
            }}
          />
          <select
            className="form-select w-auto"
            value={filters.per_page}
            onChange={(e) => {
              setPage(1);
              set("per_page", e.target.value);
            }}
          >
            <option value="15">Per Page: 15</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>District</th>
                  <th>Total Orders</th>
                  <th>💰 Total Spent</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      No customers found — try adjusting your filters
                    </td>
                  </tr>
                ) : (
                  rows.map((c, i) => (
                    <tr key={c.phone || i}>
                      <td>{i + 1}</td>
                      <td>
                        <div className="fw-semibold">{c.name || "—"}</div>
                        <small className="text-muted">{c.phone}</small>
                      </td>
                      <td>{c.district || "—"}</td>
                      <td>{c.total_orders}</td>
                      <td className="fw-semibold">{formatTk(c.total_spent)}৳</td>
                      <td>
                        <span
                          className={`badge border border-warning d-inline-flex align-items-center gap-1 ${
                            c.badge === "new" ? "bg-warning" : "bg-success"
                          }`}
                        >
                          {c.badge === "new" ? "New" : "Repeat"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            href={`/dashboard/customer_leaderboard/${c.phone}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            View Customer Details
                          </Link>
                          {c.phone && (
                            <a
                              href={`https://wa.me/${
                                c.phone.replace(/\D/g, "").startsWith("88")
                                  ? c.phone.replace(/\D/g, "")
                                  : "88" + c.phone.replace(/\D/g, "")
                              }`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-success"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <small className="text-muted">
            Page {pager.current_page} of {pager.last_page}
          </small>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= pager.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="col-lg-2 col-md-4 col-sm-6">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body">
          <small className="text-muted d-block">{label}</small>
          <h5 className="fw-bold mb-0">{value}</h5>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <PageGate permission="view leaderboard">
      <Leaderboard />
    </PageGate>
  );
}
