"use client";

import { useEffect, useState } from "react";
import { FiActivity, FiCheckCircle, FiInfo, FiSave, FiSend, FiShield } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

/**
 * GET  /api/admin/fraud-checker/settings   (admin JWT)
 *   -> { data: { is_active, cache_minutes, has_api_key, api_key_hint, provider_url } }
 * PUT  /api/admin/fraud-checker/settings   (admin JWT)
 *   <- { is_active?, cache_minutes?, api_key?, provider_url? }   (api_key omitted => unchanged)
 * POST /api/admin/fraud-checker/check      (admin JWT)
 *   <- { phone }  -> { success, data: <provider payload> }
 */
export default function CourierCheckerPage() {
  const { toast } = useFeedback();
  const { data, loading, error, reload } = useAsync(async () => {
    const body = await api.get("api/admin/fraud-checker/settings");
    return body.data || {};
  }, []);

  const [apiKey, setApiKey] = useState("");
  const [cacheMinutes, setCacheMinutes] = useState("60");
  const [providerUrl, setProviderUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!data) return;
    setCacheMinutes(String(data.cache_minutes ?? 60));
    setProviderUrl(data.provider_url || "");
    setEnabled(Boolean(data.is_active));
  }, [data]);

  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [checkError, setCheckError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    setFormError("");
    const cache = Number(cacheMinutes);
    if (!Number.isInteger(cache) || cache < 0) {
      return setFormError("Cache minutes must be a whole number of 0 or more.");
    }
    if (!providerUrl.trim().startsWith("http")) {
      return setFormError("Provider URL must start with http.");
    }
    const payload = {
      is_active: enabled,
      cache_minutes: cache,
      provider_url: providerUrl.trim(),
    };
    // Only send api_key when the admin typed a new one — the backend treats "" as "clear it".
    if (apiKey.trim()) payload.api_key = apiKey.trim();

    setBusy(true);
    try {
      await api.put("api/admin/fraud-checker/settings", payload);
      toast.success("Courier checker settings saved.");
      setApiKey("");
      reload();
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const test = async (event) => {
    event.preventDefault();
    setCheckError("");
    setResult(null);
    if (!phone.trim()) return toast.error("Enter a Bangladesh mobile number first.");
    setChecking(true);
    try {
      const body = await api.post("api/admin/fraud-checker/check", { phone: phone.trim() });
      setResult(body.data ?? body);
      toast.success("Courier check completed.");
    } catch (err) {
      setCheckError(err.message);
      toast.error(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Courier Management"
        title="Courier History Checker"
        subtitle="Configure the courier history lookup used from the order list."
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 260 }} /> : (
        <>
          <Card>
            <CardHeader
              title="Courier checker settings"
              subtitle="The API key is stored by the backend and never returned to the browser."
              actions={data.has_api_key ? <Badge tone="success">Key configured {data.api_key_hint}</Badge> : <Badge tone="warn">No API key</Badge>}
            />
            <form onSubmit={save} className="stack" style={{ maxWidth: 720 }} noValidate>
              {formError && <p className="notice notice-danger" role="alert">{formError}</p>}
              <Field label="BD Courier API key" htmlFor="courier-api-key" hint="Leave blank to keep the currently configured key.">
                <Input id="courier-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={data.has_api_key ? "•••••••• (configured)" : "Paste your API key"} autoComplete="off" />
              </Field>
              <div className="form-grid">
                <Field label="Cache result (minutes)" htmlFor="courier-cache" hint="Use 0 to disable caching.">
                  <Input id="courier-cache" type="number" min="0" step="1" value={cacheMinutes} onChange={(event) => setCacheMinutes(event.target.value)} />
                </Field>
                <Field label="Provider URL" htmlFor="courier-url" hint="Courier check endpoint supplied by the provider.">
                  <Input id="courier-url" value={providerUrl} onChange={(event) => setProviderUrl(event.target.value)} placeholder="https://api.bdcourier.com/courier-check" />
                </Field>
              </div>
              <div style={{ paddingBottom: 4 }}>
                <Toggle checked={enabled} onChange={setEnabled} label="Enable courier checker" />
              </div>
              <div className="notice notice-info">
                <FiInfo aria-hidden="true" />
                <span>The provider URL is called server-side, so the API key is never exposed to the browser.</span>
              </div>
              <div>
                <Button type="submit" variant="primary" loading={busy} disabled={busy}><FiSave aria-hidden="true" /> Save settings</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Test connection" subtitle="Runs a live courier history lookup for a phone number." />
            <form onSubmit={test} className="row" style={{ maxWidth: 720, alignItems: "end", gap: 12, flexWrap: "wrap" }} noValidate>
              <Field label="Mobile number" htmlFor="courier-phone" hint="Example: 017XXXXXXXX">
                <Input id="courier-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="017XXXXXXXX" />
              </Field>
              <Button type="submit" variant="outline" loading={checking} disabled={checking}><FiSend aria-hidden="true" /> Test API</Button>
            </form>

            {checkError && <p className="notice notice-danger" role="alert" style={{ marginTop: 16 }}>{checkError}</p>}

            {result && (
              <div className="card card-pad" style={{ marginTop: 16, border: "1px solid var(--line)", boxShadow: "none" }}>
                <div className="between" style={{ marginBottom: 12 }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 8 }}><FiShield aria-hidden="true" /> Provider response</strong>
                  <Badge tone="success"><FiCheckCircle aria-hidden="true" /> Received</Badge>
                </div>
                <pre className="num" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.85rem" }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
