"use client";

import { useEffect, useRef, useState } from "react";
import { FaTrash, FaPlus } from "react-icons/fa6";
import Swal from "sweetalert2";
import { api, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Homepage banners (/dashboard/banners)
 *  - GET    api/banners
 *  - POST   api/banners        (multipart: image, link, display_priority, is_active)
 *  - PUT    api/banners/{id}   (multipart: image, link, display_priority, is_active)
 *  - DELETE api/banners/{id}
 */
function BannersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState([
    { image: null, link: "", display_priority: "0", is_active: "true" },
  ]);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("api/banners");
      const list = r?.data?.data || r?.data || (Array.isArray(r) ? r : []);
      setRows(Array.isArray(list) ? list : []);
      const nextEdits = {};
      (Array.isArray(list) ? list : []).forEach((b) => {
        nextEdits[b.id] = {
          link: b.link || "",
          display_priority: String(b.display_priority ?? 0),
          is_active: String(Boolean(b.is_active)),
        };
      });
      setEdits(nextEdits);
    } catch (e) {
      notify.error(e.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const requests = [];
      drafts.forEach((d) => {
        if (d.image instanceof File) {
          const fd = new FormData();
          fd.append("image", d.image);
          fd.append("link", d.link || "");
          fd.append("display_priority", d.display_priority || "0");
          fd.append("is_active", d.is_active || "true");
          requests.push(api.upload("api/banners", fd));
        }
      });
      Object.entries(edits).forEach(([id, edit]) => {
        const fd = new FormData();
        fd.append("link", edit.link || "");
        fd.append("display_priority", edit.display_priority || "0");
        fd.append("is_active", edit.is_active || "false");
        requests.push(api.upload(`api/banners/${id}`, fd, { method: "PUT" }));
      });
      if (!requests.length) {
        notify.warn("Nothing to save");
        setSaving(false);
        return;
      }
      await Promise.all(requests);
      notify.success("Banners saved successfully");
      setDrafts([{ image: null, link: "", display_priority: "0", is_active: "true" }]);
      load();
    } catch (err) {
      notify.error(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const res = await Swal.fire({
      title: "Delete banner?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
    });
    if (!res.isConfirmed) return;
    try {
      await api.delete(`api/banners/${id}`);
      setRows((rs) => rs.filter((b) => b.id !== id));
      notify.success("Banner deleted");
    } catch (e) {
      notify.error(e.message || "Failed to delete");
    }
  };

  /* Replace an existing banner image using the backend's direct PUT contract. */
  const replaceImage = async (id, file) => {
    if (!file) return;
    const fd = new FormData();
    const edit = edits[id] || {};
    fd.append("image", file);
    fd.append("link", edit.link || "");
    fd.append("display_priority", edit.display_priority || "0");
    fd.append("is_active", edit.is_active || "false");
    try {
      await api.upload(`api/banners/${id}`, fd, { method: "PUT" });
      notify.success("Banner updated successfully");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to update banner");
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-3">Banners</h4>

      {/* existing */}
      <div className="row g-3 mb-4">
        {rows.map((b) => (
          <div key={b.id} className="col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <img
                src={imgUrl(b.image || `/api/banners/${b.id}/image`)}
                alt=""
                style={{ height: 150, objectFit: "cover" }}
              />
              <div className="card-body">
                <label className="form-label small mb-1">Link</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control form-control-sm mb-2"
                  onChange={(e) => replaceImage(b.id, e.target.files?.[0])}
                />
                <div className="input-group input-group-sm">
                  <input
                    className="form-control"
                    value={edits[b.id]?.link ?? ""}
                    onChange={(e) =>
                      setEdits((all) => ({
                        ...all,
                        [b.id]: { ...all[b.id], link: e.target.value },
                      }))
                    }
                  />
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => remove(b.id)}
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="col-12 text-muted">No banners yet — add the first below.</div>
        )}
      </div>

      {/* add new */}
      <form onSubmit={submit}>
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white fw-bold">Add More</div>
          <div className="card-body">
            {drafts.map((d, i) => (
              <div key={i} className="row g-2 mb-2 align-items-center">
                <div className="col-md-5">
                  <input
                    ref={(el) => (fileRefs.current[i] = el)}
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={(e) =>
                      setDrafts((list) => {
                        const n = [...list];
                        n[i] = { ...n[i], image: e.target.files?.[0] || null };
                        return n;
                      })
                    }
                  />
                </div>
                <div className="col-md-2">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Priority"
                    value={d.display_priority}
                    onChange={(e) =>
                      setDrafts((list) => list.map((item, j) => j === i
                        ? { ...item, display_priority: e.target.value }
                        : item))
                    }
                  />
                </div>
                <div className="col-md-5">
                  <input
                    className="form-control"
                    placeholder="Link (optional)"
                    value={d.link}
                    onChange={(e) =>
                      setDrafts((list) => {
                        const n = [...list];
                        n[i] = { ...n[i], link: e.target.value };
                        return n;
                      })
                    }
                  />
                </div>
                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-outline-danger w-100"
                    onClick={() =>
                      setDrafts((list) => list.filter((_, j) => j !== i))
                    }
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-sm btn-outline-primary mb-3"
              onClick={() => setDrafts((l) => [...l, {
                image: null,
                link: "",
                display_priority: "0",
                is_active: "true",
              }])}
            >
              <FaPlus /> Add More
            </button>
            <div>
              <button className="btn btn-grad" disabled={saving}>
                {saving ? "Saving..." : "Save Banners"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function BannersAdminPage() {
  return (
    <PageGate permission="view banners">
      <BannersPage />
    </PageGate>
  );
}
