"use client";

import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaTrash, FaPen } from "react-icons/fa6";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Role management (/dashboard/roles) — super-admin only
 *  - GET    api/roles        -> {roles:[{id,name,permissions:[{name,...}]}]}
 *  - GET    api/permissions  -> {permissions:[{id,name,...}]}
 *  - POST   api/roles        {name, permissions:[names]}
 *  - PUT    api/roles/{id}   {name, permissions:[names]}
 *  - DELETE api/roles/{id}
 */
function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", permissions: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get("api/roles"),
        api.get("api/permissions").catch(() => ({ permissions: [] })),
      ]);
      setRoles(r?.roles || r?.data?.roles || []);
      setPermissions(p?.permissions || p?.data?.permissions || []);
    } catch (e) {
      notify.error(e.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", permissions: [] });
    setShowModal(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({
      name: role.name,
      permissions: (role.permissions || []).map((p) => p.name || p),
    });
    setShowModal(true);
  };

  const togglePerm = (name) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(name)
        ? f.permissions.filter((p) => p !== name)
        : [...f.permissions, name],
    }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error("Role name is required");
    setSaving(true);
    try {
      const body = { name: form.name, permissions: form.permissions };
      if (editing) {
        await api.put(`api/roles/${editing.id}`, body);
        notify.success("Role updated successfully");
      } else {
        await api.post("api/roles", body);
        notify.success("Role created successfully");
      }
      setShowModal(false);
      load();
    } catch (err) {
      notify.error(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await api.delete(`api/roles/${id}`);
      notify.success("Role deleted successfully");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to delete role");
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Role Management</h1>
          <p className="text-muted mb-0">Define roles and their permissions</p>
        </div>
        <button className="btn btn-grad px-4 py-2 fw-semibold" onClick={openAdd}>
          <FaPlus className="me-2" /> Add Role
        </button>
      </div>

      <div className="row g-3">
        {roles.map((r) => (
          <div key={r.id} className="col-md-6 col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h5 className="fw-bold mb-0">{r.name}</h5>
                  <div className="d-flex gap-1">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => openEdit(r)}
                    >
                      <FaPen />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => remove(r.id)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {(r.permissions || []).length === 0 ? (
                    <small className="text-muted">No permissions</small>
                  ) : (
                    (r.permissions || []).map((p) => (
                      <span key={p.name || p} className="badge bg-light text-dark border">
                        {p.name || p}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="col-12 text-muted">No roles found.</div>
        )}
      </div>

      {showModal && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: "rgba(0,0,0,.5)", zIndex: 1040 }}
            onClick={() => setShowModal(false)}
          />
          <div
            className="position-fixed start-50 top-50 translate-middle bg-white rounded shadow p-4"
            style={{
              zIndex: 1050,
              width: "min(640px, 94vw)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <h5 className="fw-bold mb-3">{editing ? "Edit Role" : "Add Role"}</h5>
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Role Name</label>
                <input
                  className="form-control"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Permissions</label>
                <div
                  className="border rounded p-2 d-flex flex-wrap gap-2"
                  style={{ maxHeight: 300, overflowY: "auto" }}
                >
                  {permissions.map((p) => (
                    <label
                      key={p.id || p.name}
                      className={`badge border px-2 py-1 ${
                        form.permissions.includes(p.name)
                          ? "bg-primary text-white"
                          : "bg-light text-dark"
                      }`}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        className="me-1"
                        checked={form.permissions.includes(p.name)}
                        onChange={() => togglePerm(p.name)}
                      />
                      {p.name}
                    </label>
                  ))}
                  {permissions.length === 0 && (
                    <small className="text-muted">
                      No permission catalogue returned by the API.
                    </small>
                  )}
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-grad" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default function RolesAdminPage() {
  return (
    <PageGate role="super-admin">
      <RolesPage />
    </PageGate>
  );
}
