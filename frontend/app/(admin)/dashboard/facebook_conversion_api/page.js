"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";

/**
 * Facebook Pixel / Conversions API (/dashboard/facebook_conversion_api)
 *  - GET  api/facebook-settings  -> {pixel_id, access_token, test_event_code,
 *                                     is_active, is_test_mode}
 *  - POST api/facebook-settings  {…same fields}
 */
export default function FacebookConversionApiPage() {
  const [form, setForm] = useState({
    pixel_id: "",
    access_token: "",
    test_event_code: "",
    is_active: false,
    is_test_mode: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/facebook-settings");
        if (r && typeof r === "object")
          setForm((f) => ({ ...f, ...(r.data || r) }));
      } catch (e) {
        console.error("Error fetching settings:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: "", text: "" });
    try {
      const r = await api.post("api/facebook-settings", form);
      if (r?.message && /fail/i.test(r.message)) {
        setFeedback({ type: "error", text: r.message });
      } else {
        setFeedback({
          type: "success",
          text: r?.message || "Settings saved successfully!",
        });
        notify.success("Settings saved successfully!");
      }
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageGate permission="view settings">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h4 className="fw-bold mb-1">Facebook Conversions API Settings</h4>
          <p className="text-muted">
            Configure your Facebook Pixel and Conversions API credentials
          </p>

          {feedback.text && (
            <div
              className={`alert alert-${
                feedback.type === "success" ? "success" : "danger"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <div className="alert alert-light border small mb-3">
                <b>📋 How to get credentials:</b>
                <ol className="mb-0 mt-1">
                  <li>Open Facebook Events Manager</li>
                  <li>Select your Pixel → Settings tab</li>
                  <li>Copy the Pixel ID and Access Token</li>
                </ol>
              </div>

              <form onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Pixel ID *</label>
                  <input
                    className="form-control"
                    required
                    value={form.pixel_id}
                    onChange={(e) => set("pixel_id", e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Access Token *</label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    autoComplete="off"
                    value={form.access_token}
                    onChange={(e) => set("access_token", e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Test Event Code (Optional)
                  </label>
                  <input
                    className="form-control"
                    value={form.test_event_code}
                    onChange={(e) => set("test_event_code", e.target.value)}
                  />
                  <small className="text-muted">
                    Use this for testing. Leave empty for production.
                  </small>
                </div>
                <div className="mb-3">
                  <label className="d-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={(e) => set("is_active", e.target.checked)}
                    />
                    <span className="fw-semibold">Enable Facebook Tracking</span>
                  </label>
                  <small className="text-muted d-block">
                    Turn on to start sending events to Facebook.
                  </small>
                </div>
                <div className="mb-3">
                  <label className="d-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!form.is_test_mode}
                      onChange={(e) => set("is_test_mode", e.target.checked)}
                    />
                    <span className="fw-semibold">Test Mode</span>
                  </label>
                  <small className="text-muted d-block">
                    Events will show in Test Events tab (recommended for testing)
                  </small>
                </div>
                <button className="btn btn-grad px-4" disabled={saving || loading}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </form>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-bold">Current Status</div>
            <div className="card-body d-flex gap-4">
              <div>
                <small className="text-muted d-block">Tracking:</small>
                <span
                  className={`badge ${
                    form.is_active ? "bg-success" : "bg-secondary"
                  }`}
                >
                  {form.is_active ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div>
                <small className="text-muted d-block">Mode:</small>
                <span
                  className={`badge ${
                    form.is_test_mode ? "bg-warning text-dark" : "bg-primary"
                  }`}
                >
                  {form.is_test_mode ? "Test" : "Live"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageGate>
  );
}
