"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";

/** Product sizes are documented as variants in GET /api/products. */
function SizesList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search.trim()) p.set("search", search.trim());
      if (status && status !== "all") p.set("status", status);
      const r = await api.get(`api/admin/sizes?${p.toString()}`);
      const data = r?.data ?? r;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify.error(e.message || "Failed to load sizes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const toggleActive = async (row) => {
    try {
      await api.put(`api/admin/sizes/${row.id}`, { isActive: !row.is_active });
      notify.success(row.is_active ? "Size deactivated." : "Size activated.");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to update size");
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete size "${row.size}"?`)) return;
    try {
      await api.delete(`api/admin/sizes/${row.id}`);
      notify.success("Size deleted.");
      setRows((rs) => rs.filter((s) => s.id !== row.id));
    } catch (e) {
      notify.error(e.message || "Failed to delete size");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0 fw-bold">Sizes</h4>
        <Link href="/admin/sizes/add" className="btn btn-grad">
          + Add Size
        </Link>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3 d-flex gap-2 flex-wrap align-items-end">
          <div>
            <label className="form-label small mb-1">Search</label>
            <input
              className="form-control form-control-sm"
              style={{ maxWidth: 240 }}
              placeholder="Search size"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label small mb-1">Status</label>
            <select
              className="form-select form-select-sm w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Size</th>
                <th>Position</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-4">
                    <span className="spinner-border spinner-border-sm" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    No Sizes Found
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.size}</td>
                    <td>{s.position}</td>
                    <td>
                      <span className={`badge ${s.is_active ? "bg-success" : "bg-secondary"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Link
                          href={`/admin/sizes/edit/${s.id}`}
                          className="btn btn-sm btn-outline-warning"
                        >
                          Edit
                        </Link>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => toggleActive(s)}
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => remove(s)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SizesAdminPage() {
  return (
    <PageGate permission="view sizes">
      <SizesList />
    </PageGate>
  );
}
