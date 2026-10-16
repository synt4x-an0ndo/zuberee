"use client";

import { useEffect, useState } from "react";
import { FiInfo, FiSave, FiShield } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * GET /api/facebook-settings                public -> { id, pixel_id, access_token, test_event_code,
 *                                                       is_active, is_test_mode, created_at, updated_at }
 *                                                       (404 when unconfigured)
 * PUT /api/admin/admin/facebook-settings    ADMIN  <- { pixel_id?, access_token?, test_event_code?,
 *                                                       is_active?, is_test_mode? }  (upsert)
 *
 * NOTE: readme_frontend.txt documents this write path as PUT /api/admin/facebook-settings, but the
 * route folder on disk is backend/app/api/admin/admin/facebook-settings, so the real URL has a
 * doubled segment. A probe of PUT /api/admin/facebook-settings returns 404, and the doubled path
 * answers 405 for GET, i.e. the route only exists with the doubled segment.
 */
const WRITE_PATH = "api/admin/admin/facebook-settings";

export default function FacebookConversionApiPage() {
  const { toast } = useFeedback();
  const { data, loading, error, reload } = useAsync(async () => {
    return api.get("api/facebook-settings", { auth: false }).catch((err) => (err.status === 404 ? null : Promise.reject(err)));
  }, []);

  const [form, setForm] = useState({ pixel_id: "", access_token: "", test_event_code: "", is_active: false, is_test_mode: false });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      pixel_id: data.pixel_id || "",
      access_token: data.access_token || "",
      test_event_code: data.test_event_code || "",
      is_active: Boolean(data.is_active),
      is_test_mode: Boolean(data.is_test_mode),
    });
  }, [data]);

  const save = async (event) => {
    event.preventDefault();
    setFormError("");
    if (form.is_active && !form.pixel_id.trim()) {
      return setFormError("A Pixel ID is required before the pixel can be enabled.");
    }
    setBusy(true);
    try {
      const body = await api.put(WRITE_PATH, {
        pixel_id: form.pixel_id.trim(),
        access_token: form.access_token.trim(),
        test_event_code: form.test_event_code.trim(),
        is_active: form.is_active,
        is_test_mode: form.is_test_mode,
      });
      toast.success(body?.message || "Facebook settings saved.");
      reload();
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Storefront"
        title="Facebook conversion API"
        subtitle="Server-side Meta pixel credentials used for conversion tracking."
        actions={data?.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
      />

      <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
        <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          The backend route for saving these values is <code>PUT /api/admin/admin/facebook-settings</code> — the folder
          <code> app/api/admin/admin/facebook-settings</code> doubles the <code>admin</code> segment. The documented
          path <code>/api/admin/facebook-settings</code> returns 404, so this page uses the path that actually exists.
        </span>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton style={{ height: 420 }} /> : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Card>
            <CardHeader
              title="Pixel credentials"
              subtitle={data?.updated_at ? `Last updated ${formatDateTime(data.updated_at)}` : "Not configured yet — saving creates the record."}
            />
            <form onSubmit={save} className="stack" noValidate>
              {formError && <p className="notice notice-danger" role="alert">{formError}</p>}
              <Field label="Pixel ID" htmlFor="fb-pixel">
                <Input id="fb-pixel" value={form.pixel_id} onChange={(e) => setForm({ ...form, pixel_id: e.target.value })} placeholder="123456789012345" />
              </Field>
              <Field label="Access token" htmlFor="fb-token" hint="Sent to the backend as stored text; the storefront never reads this value.">
                <Input id="fb-token" type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} autoComplete="off" placeholder="EAAG…" />
              </Field>
              <Field label="Test event code" htmlFor="fb-test" hint="Optional. Used while verifying events in Events Manager.">
                <Input id="fb-test" value={form.test_event_code} onChange={(e) => setForm({ ...form, test_event_code: e.target.value })} placeholder="TEST12345" />
              </Field>
              <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Enable conversion tracking" />
              <Toggle checked={form.is_test_mode} onChange={(v) => setForm({ ...form, is_test_mode: v })} label="Send events in test mode" />
              <div>
                <Button type="submit" variant="primary" loading={busy} disabled={busy}><FiSave aria-hidden="true" /> Save settings</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Security note" />
            <div className="stack" style={{ gap: 12 }}>
              <p className="muted" style={{ display: "flex", gap: 10 }}>
                <FiShield aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
                <span>
                  <code>GET /api/facebook-settings</code> is public and returns the access token in full. Until the
                  backend stops returning <code>access_token</code> from that route, treat the token as exposed and
                  restrict what it is allowed to do.
                </span>
              </p>
              {data?.access_token ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Current token length: <span className="num">{String(data.access_token).length}</span> characters.
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
