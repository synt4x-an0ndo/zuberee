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
 *  - POST   api/banners        (multipart: banners[i][image], banners[i][link],
 *                               image_links[{id}][link] to relink existing)
 *  - POST   api/banners/{id}   (+ _method=PUT)  — edit links / replace image
 *  - DELETE api/banners/{id}
 */
function BannersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState([{ image: null, link: "" }]); // new uploads
  const [linkEdits, setLinkEdits] = useState({}); // existing id -> link
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("api/banners");
      const list = r?.data?.data || r?.data || (Array.isArray(r) ? r : []);
      setRows(Array.isArray(list) ? list : []);
      const edits = {};
      (Array.isArray(list) ? list : []).forEach((b) => {
        edits[b.id] = b.link || "";
      });
      setLinkEdits(edits);
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
      const fd = new FormData();
      let i = 0;
      drafts.forEach((d) => {
        if (d.image instanceof File) {
          fd.append(`banners[${i}][image]`, d.image);
          fd.append(`banners[${i}][link]`, d.link || "");
          i++;
        }
      });
      Object.entries(linkEdits).forEach(([id, link]) => {
        fd.append(`image_links[${id}][id]`, id);
        fd.append(`image_links[${id}][link]`, link || "");
      });
      if (i === 0 && !Object.keys(linkEdits).length) {
        notify.warn("Nothing to save");
        setSaving(false);
        return;
      }
      await api.upload("api/banners", fd);
      notify.success("Banners saved successfully");
      setDrafts([{ image: null, link: "" }]);
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

  /* replace an existing banner's image: POST api/banners/{id} + _method=PUT */
  const replaceImage = async (id, file, link) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("banners[0][image]", file);
    fd.append("banners[0][link]", link || "");
    fd.append("_method", "PUT");
    try {
      await api.upload(`api/banners/${id}`, fd);
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
                src={imgUrl(b.image)}
                alt=""
                style={{ height: 150, objectFit: "cover" }}
              />
              <div className="card-body">
                <label className="form-label small mb-1">Link</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control form-control-sm mb-2"
                  onChange={(e) => replaceImage(b.id, e.target.files?.[0], linkEdits[b.id])}
                />
                <div className="input-group input-group-sm">
                  <input
                    className="form-control"
                    value={linkEdits[b.id] ?? ""}
                    onChange={(e) =>
                      setLinkEdits((l) => ({ ...l, [b.id]: e.target.value }))
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
              onClick={() => setDrafts((l) => [...l, { image: null, link: "" }])}
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
