"use client";

import { useEffect, useState } from "react";
import { api, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Footer / web settings (/dashboard/footerSettings)
 *  - GET api/footer-settings         (single object or {data:[{id,...}]} —
 *                                      normalised to the first record)
 *  - PUT api/footer-settings/{id}    JSON {company_description, company_address,
 *                                          company_email, company_phone}
 *      (multipart with logo: POST + _method=PUT + company_logo)
 * Known fields: company_logo?, company_description, company_address,
 *               company_email, company_phone
 */
function FooterSettings() {
  const [row, setRow] = useState(null);
  const [form, setForm] = useState({
    company_description: "",
    company_address: "",
    company_email: "",
    company_phone: "",
  });
  const [logo, setLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/footer-settings", { auth: false });
        const d = Array.isArray(r?.data)
          ? r.data[0]
          : r?.data?.data
          ? r.data.data[0]
          : r?.data || r;
        setRow(d);
        setForm({
          company_description: d?.company_description || "",
          company_address: d?.company_address || "",
          company_email: d?.company_email || "",
          company_phone: d?.company_phone || "",
        });
      } catch {
        notify.error("Failed to load footer settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!row?.id) return notify.error("No footer-settings record found.");
    setSaving(true);
    try {
      if (logo) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append("company_logo", logo);
        fd.append("_method", "PUT");
        await api.upload(`api/footer-settings/${row.id}`, fd);
      } else {
        await api.put(`api/footer-settings/${row.id}`, form);
      }
      notify.success("Web settings updated");
    } catch (err) {
      notify.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-7">
        <h4 className="fw-bold mb-3">Web Settings</h4>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Company Logo</label>
                {row?.company_logo && !logo && (
                  <div className="mb-2">
                    <img
                      src={imgUrl(row.company_logo)}
                      alt=""
                      style={{ maxHeight: 60 }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setLogo(e.target.files?.[0] || null)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Company Description</label>
                <textarea
                  rows={3}
                  className="form-control"
                  value={form.company_description}
                  onChange={(e) => set("company_description", e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Company Address</label>
                <input
                  className="form-control"
                  value={form.company_address}
                  onChange={(e) => set("company_address", e.target.value)}
                />
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Company Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.company_email}
                    onChange={(e) => set("company_email", e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Company Phone</label>
                  <input
                    className="form-control"
                    value={form.company_phone}
                    onChange={(e) => set("company_phone", e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-grad px-4" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FooterSettingsPage() {
  return (
    <PageGate permission="view settings">
      <FooterSettings />
    </PageGate>
  );
}
