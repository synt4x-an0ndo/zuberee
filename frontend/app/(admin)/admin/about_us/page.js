"use client";

import { useEffect, useState } from "react";
import { api, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import "@/styles/css/8b54669db085020c.css";
import Loader from "@/components/Loader";

/**
 * About Us content editor (/dashboard/about_us)
 *  - GET api/about-us                -> {data:{id,title,content,image?}}
 *  - PUT api/about-us/{id}           {title, content}  (JSON)
 *      (multipart variant supported when an image file is added:
 *       POST api/about-us/{id} + _method=PUT + image)
 */
function AboutUsAdmin() {
  const [row, setRow] = useState(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/about-us");
        const d = r?.data || r;
        setRow(d);
        setForm({ title: d?.title || "", content: d?.content || "" });
      } catch {
        notify.error("Failed to load About Us content");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!row?.id) return notify.error("No About Us record found on the backend.");
    setSaving(true);
    try {
      if (image) {
        const fd = new FormData();
        fd.append("title", form.title);
        fd.append("content", form.content);
        fd.append("image", image);
        fd.append("_method", "PUT");
        await api.upload(`api/about-us/${row.id}`, fd);
      } else {
        await api.put(`api/about-us/${row.id}`, {
          title: form.title,
          content: form.content,
        });
      }
      notify.success("About Us updated");
    } catch (err) {
      notify.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <h4 className="fw-bold mb-3">About Us</h4>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Title</label>
                <input
                  className="form-control"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Content</label>
                <textarea
                  rows={12}
                  className="form-control"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                />
                <small className="text-muted">HTML is supported.</small>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Image</label>
                {row?.image && !image && (
                  <div className="mb-2">
                    <img
                      src={imgUrl(row.image)}
                      alt=""
                      style={{ maxHeight: 100, borderRadius: 6 }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </div>
              <button className="btn btn-grad px-4" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AboutUsAdminPage() {
  return (
    <PageGate permission="view settings">
      <AboutUsAdmin />
    </PageGate>
  );
}
