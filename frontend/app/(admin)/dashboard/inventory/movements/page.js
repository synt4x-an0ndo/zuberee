"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import PageGate from "@/components/admin/PageGate";

import "@/styles/css/19b7b7f3433c440d.css";

const TYPES = {
  initial: { label: "Opening", accent: "#98a2b3" },
  purchase: { label: "Received", accent: "#17a97f" },
  adjustment: { label: "Adjusted", accent: "#6172f3" },
  reserve: { label: "Held", accent: "#f79009" },
  release: { label: "Released", accent: "#7f56d9" },
  sale: { label: "Sold", accent: "#f04438" },
  return: { label: "Returned", accent: "#0ba5ec" },
  damage: { label: "Damaged", accent: "#b42318" },
};

/**
 * Stock history (/dashboard/inventory/movements)
 *  - GET api/inventory/movements?page=&per_page=40&type=&start_date=&end_date=
 *    -> { data: { data:[{created_at,product_title,variant_label,type,change,stock_after,reference,created_by}],
 *                 current_page,last_page,total,from,to } }
 */
function MovementsPage() {
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: "40" });
      if (type) qs.set("type", type);
      if (start) qs.set("start_date", start);
      if (end) qs.set("end_date", end);
      const r = await api.get(`api/inventory/movements?${qs.toString()}`);
      const d = r?.data?.data || [];
      setRows(Array.isArray(d) ? d : []);
      setPager({
        current_page: r?.data?.current_page || 1,
        last_page: r?.data?.last_page || 1,
        total: r?.data?.total || 0,
        from: r?.data?.from || 0,
        to: r?.data?.to || 0,
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, type, start, end]);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (s) => {
    if (!s) return "N/A";
    try {
      const d = new Date(s);
      return {
        date: d.toLocaleDateString("en-US", {
          timeZone: "Asia/Dhaka",
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        time: d.toLocaleTimeString("en-US", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    } catch {
      return { date: "N/A", time: "" };
    }
  };

  return (
    <div className="inv-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0 fw-bold">Stock History</h4>
        <Link href="/dashboard/inventory" className="btn btn-sm btn-outline-secondary">
          ← Back to Inventory
        </Link>
      </div>

      {/* filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3 d-flex gap-2 flex-wrap align-items-center">
          <select
            className="form-select w-auto"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All movement types</option>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="form-control w-auto"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPage(1);
            }}
          />
          {(type || start || end) && (
            <button
              className="inv-chip"
              onClick={() => {
                setType("");
                setStart("");
                setEnd("");
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Stock after</th>
                  <th>Reference</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      No movements found
                    </td>
                  </tr>
                ) : (
                  rows.map((m, i) => {
                    const t = TYPES[m.type] || { label: m.type, accent: "#98a2b3" };
                    const when = fmt(m.created_at);
                    const change = Number(m.change ?? m.quantity ?? 0);
                    return (
                      <tr key={m.id ?? i}>
                        <td>
                          <div className="small fw-semibold">{when.date}</div>
                          <small className="text-muted">{when.time}</small>
                        </td>
                        <td className="fw-semibold">{m.product_title || m.product?.title}</td>
                        <td>{m.variant_label || "—"}</td>
                        <td>
                          <span
                            className="inv-badge"
                            style={{ color: t.accent, borderColor: t.accent }}
                          >
                            {t.label}
                          </span>
                        </td>
                        <td className={change < 0 ? "text-danger fw-bold" : "text-success fw-bold"}>
                          {change > 0 ? "+" : ""}
                          {change}
                        </td>
                        <td>{m.stock_after ?? m.stock ?? "—"}</td>
                        <td>
                          <small>{m.reference || m.note || "—"}</small>
                        </td>
                        <td>
                          <small>{m.created_by || m.user?.name || "—"}</small>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <small className="text-muted">
            Showing {pager.from}–{pager.to} of {pager.total}
          </small>
          <div className="d-flex gap-2">
            <button
              className="inv-btn inv-btn-ghost inv-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="inv-btn inv-btn-ghost inv-btn-sm"
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

export default function InventoryMovementsPage() {
  return (
    <PageGate permission="manage inventory">
      <MovementsPage />
    </PageGate>
  );
}
