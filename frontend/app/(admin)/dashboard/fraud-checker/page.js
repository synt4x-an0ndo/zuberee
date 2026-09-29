"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Courier / fraud checker settings (/dashboard/fraud-checker)
 *  - GET  api/fraud-checker/settings   -> {data:{api_key_hint, provider_url,
 *                                                is_active, cache_minutes, ...}}
 *  - PUT  api/fraud-checker/settings   {api_key, is_active, cache_minutes}
 *  - POST api/fraud-checker/settings/test {phone}  -> {data:{...provider result}}
 * Note: the API key never round-trips to the browser (only api_key_hint).
 */
function FraudCheckerSettings() {
  const [form, setForm] = useState({
    api_key: "",
    is_active: false,
    cache_minutes: 0,
    provider_url: "",
    api_key_hint: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/fraud-checker/settings");
        setForm((f) => ({ ...f, ...(r?.data || {}) }));
      } catch (e) {
        notify.error(e.message || "Failed to load courier checker settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.put("api/fraud-checker/settings", {
        api_key: form.api_key,
        is_active: form.is_active,
        cache_minutes: Number(form.cache_minutes),
      });
      setForm((f) => ({ ...f, ...(r?.data || {}), api_key: "" }));
      notify.success("Courier checker settings saved.");
    } catch (err) {
      notify.error(err.message || "Failed to save courier checker settings.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!phone.trim()) return notify.error("Enter a phone number to test.");
    setTesting(true);
    setResult(null);
    try {
      const r = await api.post("api/fraud-checker/settings/test", { phone });
      setResult(r?.data);
      notify.success("Courier checker connection successful.");
    } catch (e) {
      notify.error(e.message || "Courier checker test failed.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-7">
        <h4 className="fw-bold mb-3">Courier History Checker</h4>
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-4">
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label fw-semibold">BD Courier API key</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder={
                    form.api_key_hint ? `Saved (hint: ${form.api_key_hint})` : "Paste API key"
                  }
                  value={form.api_key}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, api_key: e.target.value }))
                  }
                  autoComplete="off"
                />
                <small className="text-danger">
                  Do not put this key in frontend environment variables or source code.
                </small>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Cache result (minutes)</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={form.cache_minutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cache_minutes: e.target.value }))
                  }
                />
                <small className="text-muted">
                  Use 0 to disable caching. Caching avoids repeated provider requests
                  for the same phone.
                </small>
              </div>
              <div className="mb-3">
                <label className="d-flex align-items-center gap-2" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  <span className="fw-semibold">Enable courier checker</span>
                </label>
              </div>
              {form.provider_url != null && form.provider_url !== "" && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Provider endpoint</label>
                  <input className="form-control" value={form.provider_url} readOnly />
                </div>
              )}
              <button className="btn btn-grad px-4" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <h6 className="fw-bold">Test connection</h6>
            <small className="text-muted d-block mb-3">
              Save the API key first, then test it with a known Bangladesh mobile
              number.
            </small>
            <div className="d-flex gap-2">
              <input
                className="form-control"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={testing}
                onClick={test}
              >
                {testing ? "Testing..." : "Test"}
              </button>
            </div>
            {result && (
              <pre className="bg-light p-2 rounded mt-3 small mb-0">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
            {result && <div className="text-success small mt-2">Connection successful.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FraudCheckerPage() {
  return (
    <PageGate permission="view settings">
      <FraudCheckerSettings />
    </PageGate>
  );
}
