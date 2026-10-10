"use client";

import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaTrash, FaPen } from "react-icons/fa6";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * User management (/dashboard/users) — super-admin only
 *  - GET    api/users
 *  - GET    api/roles                 -> {roles:[{id,name,permissions:[...]}]}
 *  - POST   api/users   {name, email, password, role}
 *  - PUT    api/users/{id} {…}
 *  - POST   api/users/{id}/assign-role {role}
 *  - DELETE api/users/{id}
 */
function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get("api/users"),
        api.get("api/roles").catch(() => ({ roles: [] })),
      ]);
      const list = u?.data?.data || u?.data?.users || u?.data || (Array.isArray(u) ? u : []);
      setUsers(Array.isArray(list) ? list : []);
      setRoles(r?.roles || r?.data?.roles || []);
    } catch (e) {
      notify.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "" });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name || "",
      email: u.email || "",
      password: "",
      role: u.role || u.roles?.[0]?.name || "",
    });
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const body = { name: form.name, email: form.email, role: form.role };
        if (form.password) body.password = form.password;
        await api.put(`api/users/${editing.id}`, body);
        if (form.role) {
          await api.post(`api/users/${editing.id}/assign-role`, { role: form.role });
        }
        notify.success("User updated successfully");
      } else {
        await api.post("api/users", form);
        notify.success("User created successfully");
      }
      setShowModal(false);
      load();
    } catch (err) {
      notify.error(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const assignRole = async (id, role) => {
    try {
      await api.post(`api/users/${id}/assign-role`, { role });
      notify.success("Role assigned successfully");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to assign role");
    }
  };

  const remove = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`api/users/${id}`);
      notify.success("User deleted successfully");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to delete user");
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">User Management</h1>
          <p className="text-muted mb-0">Manage users, roles, and permissions</p>
        </div>
        <button className="btn btn-grad px-4 py-2 fw-semibold" onClick={openAdd}>
          <FaPlus className="me-2" /> Add User
        </button>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="form-select form-select-sm w-auto"
                        value={u.role || u.roles?.[0]?.name || ""}
                        onChange={(e) => assignRole(u.id, e.target.value)}
                      >
                        <option value="">Select Role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEdit(u)}
                        >
                          <FaPen /> Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => remove(u.id)}
                        >
                          <FaTrash />
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

      {showModal && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: "rgba(0,0,0,.5)", zIndex: 1040 }}
            onClick={() => setShowModal(false)}
          />
          <div
            className="position-fixed start-50 top-50 translate-middle bg-white rounded shadow p-4"
            style={{ zIndex: 1050, width: "min(460px, 94vw)" }}
          >
            <h5 className="fw-bold mb-3">
              {editing ? "Edit User" : "Create New User"}
            </h5>
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input
                  className="form-control"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">
                  Password {editing && "(leave blank to keep)"}
                </label>
                <input
                  type="password"
                  className="form-control"
                  required={!editing}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="">Select Role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
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

export default function UsersAdminPage() {
  return (
    <PageGate role="super-admin">
      <UsersPage />
    </PageGate>
  );
}
