"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaPen } from "react-icons/fa6";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";

/**
 * Customers (/dashboard/customers)
 *  - GET api/customer-profiles?search=&badge=&page=  (paginated)
 * Badge filter: All badges / specific badge titles.
 */
function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [badge, setBadge] = useState("");
  const [badges, setBadges] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page) });
      if (query) p.append("search", query);
      if (badge) p.append("badge", badge);
      const r = await api.get(`api/customer-profiles?${p.toString()}`);
      const d = r?.data?.data || r?.data || [];
      setRows(Array.isArray(d) ? d : []);
      setPager({
        current_page: r?.data?.current_page || 1,
        last_page: r?.data?.last_page || 1,
      });
      // collect badge options
      const set2 = new Set();
      (Array.isArray(d) ? d : []).forEach((c) => {
        const t = c.assigned_badge?.title || c.badge;
        if (t) set2.add(t);
      });
      setBadges([...set2]);
    } catch (e) {
      notify.error(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [page, query, badge]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== query) {
        setPage(1);
        setQuery(search);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [search, query]);

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-3">Customers</h4>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-white fw-bold">Search &amp; Filter Customers</div>
        <div className="card-body py-3 d-flex gap-2 flex-wrap">
          <input
            className="form-control w-auto"
            style={{ maxWidth: 280 }}
            placeholder="Search name / phone / email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select w-auto"
            value={badge}
            onChange={(e) => {
              setPage(1);
              setBadge(e.target.value);
            }}
          >
            <option value="">All badges</option>
            {badges.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Badge</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    No customers found
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-semibold">{c.name || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.email || "—"}</td>
                    <td>
                      {c.assigned_badge?.title || c.badge ? (
                        <span className="badge bg-primary">
                          {c.assigned_badge?.title || c.badge}
                        </span>
                      ) : (
                        <span className="text-muted small">No badge</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/customers/edit/${c.id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        <FaPen /> Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

export default function CustomersAdminPage() {
  return (
    <PageGate permission="view customers">
      <CustomersPage />
    </PageGate>
  );
}
