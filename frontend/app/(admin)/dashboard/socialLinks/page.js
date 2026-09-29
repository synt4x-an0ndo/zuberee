"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Social links (/dashboard/socialLinks)
 *  - GET  api/social-links        -> {data:{id, facebook, youtube, instagram,
 *                                           tweeter, pinterest, facebook_id,
 *                                           whatsapp_number}}
 *  - POST api/social-links            {…fields}          (first save)
 *  - PUT  api/social-links/{id}       {…fields}          (update)
 *  - refresh: GET api/social-links-first (storefront source)
 */
function SocialLinks() {
  const [id, setId] = useState(null);
  const [form, setForm] = useState({
    facebook: "",
    youtube: "",
    instagram: "",
    tweeter: "",
    pinterest: "",
    facebook_id: "",
    whatsapp_number: "+880",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/social-links", { auth: false });
        const d = Array.isArray(r?.data) ? r.data[0] : r?.data || r;
        if (d) {
          setId(d.id);
          setForm({
            facebook: d.facebook || "",
            youtube: d.youtube || "",
            instagram: d.instagram || "",
            tweeter: d.tweeter || "",
            pinterest: d.pinterest || "",
            facebook_id: d.facebook_id || "",
            whatsapp_number: d.whatsapp_number || "+880",
          });
        }
      } catch {
        notify.error("Failed to load social links");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (id) {
        await api.put(`api/social-links/${id}`, form);
        notify.success("Social links updated!");
      } else {
        const r = await api.post("api/social-links", form);
        setId(r?.data?.id || r?.id || null);
        notify.success("Social links saved!");
      }
      await api.get("api/social-links-first", { auth: false });
    } catch (err) {
      notify.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-7">
        <h4 className="fw-bold mb-3">Social Links</h4>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Whatsapp Number</label>
                <div className="input-group">
                  <span className="input-group-text">+880</span>
                  <input
                    className="form-control"
                    value={form.whatsapp_number.replace(/^\+880/, "")}
                    onChange={(e) =>
                      set("whatsapp_number", `+880${e.target.value.replace(/\D/g, "")}`)
                    }
                  />
                </div>
              </div>
              {[
                ["facebook", "Facebook"],
                ["youtube", "YouTube"],
                ["instagram", "Instagram"],
                ["tweeter", "Twitter / X"],
                ["pinterest", "Pinterest"],
                ["facebook_id", "Facebook Page ID"],
              ].map(([k, label]) => (
                <div className="mb-3" key={k}>
                  <label className="form-label fw-semibold">{label}</label>
                  <input
                    className="form-control"
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </div>
              ))}
              <button className="btn btn-grad px-4" disabled={saving}>
                {saving ? "Saving..." : "Save Links"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialLinksPage() {
  return (
    <PageGate permission="view settings">
      <SocialLinks />
    </PageGate>
  );
}
