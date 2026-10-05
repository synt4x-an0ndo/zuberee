"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaPen, FaTrash, FaMagnifyingGlass as FaSearch } from "react-icons/fa6";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";

/**
 * Collections / Categories list (/dashboard/category)
 *  - GET    api/categories?page=&search=      (paged: data, current_page, last_page)
 *  - DELETE api/categories/{id}               (removes subcategories too)
 * This is the "collection editor" hub: from here the admin can create,
 * edit, reorder and delete every storefront collection.
 */
function CategoryList() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = query
        ? `api/categories?page=${page}&search=${encodeURIComponent(query)}`
        : `api/categories?page=${page}`;
      const r = await api.get(qs);
      const pageData = r?.data && !Array.isArray(r.data) && Array.isArray(r.data.data) ? r.data : r;
      setRows(Array.isArray(pageData?.data) ? pageData.data : []);
      setPager({ current_page: pageData?.current_page || 1, last_page: pageData?.last_page || 1 });
    } catch (e) {
      setError(e.message || "Failed to load categories");
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  /* debounced search */
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== query) {
        setPage(1);
        setQuery(search);
        setSearching(true);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [search, query]);

  const remove = async (id) => {
    const res = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete subcategories too!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
    });
    if (!res.isConfirmed) return;
    try {
      await api.delete(`api/categories/${id}`);
      Swal.fire("Deleted!", "", "success");
      notify.success("Category deleted. Refresh to see updated list.");
      load();
    } catch {
      notify.error("Failed to delete category");
    }
  };

  return (
    <div>
      {/* head */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-0 fw-bold">Collections / Categories</h4>
          <small className="text-muted">
            Manage every storefront collection — no coding needed.
          </small>
        </div>
        <Link href="/dashboard/category/add" className="btn btn-grad">
          <FaPlus className="me-1" /> Add Category
        </Link>
      </div>

      {/* search */}
      <div className="mb-3" style={{ maxWidth: 380, position: "relative" }}>
        <div className="input-group">
          <span className="input-group-text bg-white">
            <FaSearch />
          </span>
          <input
            className="form-control"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              Clear search
            </button>
          )}
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
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Parent</th>
                  <th>Size Guide Type</th>
                  <th>Stock</th>
                  <th>Home</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading || searching ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      <span className="spinner-border spinner-border-sm me-2" />
                      {searching ? "Searching categories..." : "Loading..."}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-danger">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      No Categories Found
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td className="fw-semibold">{c.name}</td>
                      <td>
                        <code>{c.slug}</code>
                      </td>
                      <td>
                        {c.parent ? (
                          <span className="badge bg-secondary">{c.parent.name}</span>
                        ) : (
                          <span className="text-muted">Root</span>
                        )}
                      </td>
                      <td>{c.size_guide_type ?? "N/A"}</td>
                      <td>
                        {c.track_inventory ? (
                          <span className="badge bg-success">Tracked</span>
                        ) : (
                          <span className="badge bg-light text-secondary border">Off</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${c.home_category ? "bg-info" : "bg-danger"}`}>
                          {c.home_category ? "On" : "Off"}
                        </span>
                      </td>
                      <td>{c.priority}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            href={`/dashboard/category/edit/${c.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            <FaPen /> Edit
                          </Link>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => remove(c.id)}
                          >
                            <FaTrash /> Delete
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

        {/* pagination */}
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

export default function CategoryAdminPage() {
  return (
    <PageGate permission="view categories">
      <CategoryList />
    </PageGate>
  );
}
