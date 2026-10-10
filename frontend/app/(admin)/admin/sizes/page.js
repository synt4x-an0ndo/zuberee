"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaPen, FaTrash } from "react-icons/fa6";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";

/** Sizes list - GET api/sizes (public), DELETE api/sizes/{id} */
function SizesList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("api/sizes", { auth: false });
      setRows(Array.isArray(r) ? r : r?.data || []);
    } catch (e) {
      notify.error(e.message || "Failed to load sizes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id) => {
    const res = await Swal.fire({
      title: "Delete size?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
    });
    if (!res.isConfirmed) return;
    try {
      await api.delete(`api/sizes/${id}`);
      notify.success("Size deleted");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to delete size");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0 fw-bold">Sizes</h4>
        <Link href="/admin/sizes/add" className="btn btn-grad">
          <FaPlus className="me-1" /> Add Size
        </Link>
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-4">
                    <span className="spinner-border spinner-border-sm" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted">
                    No Sizes Found
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td className="fw-semibold">{s.size}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <Link
                          href={`/admin/sizes/edit/${s.id}`}
                          className="btn btn-sm btn-outline-primary"
                        >
                          <FaPen /> Edit
                        </Link>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => remove(s.id)}
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
