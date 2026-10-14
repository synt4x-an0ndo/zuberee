"use client";

import { useState } from "react";
import { FiInfo } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, ErrorState, Field, Input, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function ShippingPage() {
  const { toast } = useFeedback();
  const { data, loading, error, reload } = useAsync(() => api.get("api/admin/shipping-costs-latest").then((b) => b.data || b), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const current = form ?? { inside: data?.inside_dhaka ?? "", outside: data?.outside_dhaka ?? "", one: data?.one_shipping_cost ?? "" };

  const save = async (event) => {
    event.preventDefault();
    setErr("");
    const inside = Number(current.inside);
    const outside = Number(current.outside);
    if (current.inside === "" || current.outside === "" || !Number.isFinite(inside) || !Number.isFinite(outside) || inside < 0 || outside < 0) {
      return setErr("Enter delivery costs for inside and outside Dhaka.");
    }
    setBusy(true);
    try {
      await api.post("api/admin/shipping-costs", { inside_dhaka: inside, outside_dhaka: outside, one_shipping_cost: current.one === "" ? null : Number(current.one) });
      toast.success("Shipping costs saved.");
      setForm(null);
      reload();
    } catch (e) {
      toast.error(e.message || "Shipping costs could not be saved.");
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 980 }}>
      <AdminHeader eyebrow="Sales" title="Shipping costs" subtitle="Default delivery charges for inside and outside Dhaka." />

      <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
        <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          Saved here for your records and order admin. The storefront checkout cannot read these figures yet because the backend has no public shipping endpoint, so customers see delivery as confirmed on call.
        </span>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton style={{ height: 200 }} /> : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Card>
            <CardHeader title="Current rates" subtitle={data?.created_at ? `Saved ${formatDateTime(data.created_at)}` : "Not set yet"} />
            <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Stat label="Inside Dhaka" value={data?.inside_dhaka != null ? formatMoney(data.inside_dhaka) : "—"} tone="brand" />
              <Stat label="Outside Dhaka" value={data?.outside_dhaka != null ? formatMoney(data.outside_dhaka) : "—"} tone="info" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Update rates" />
            <form onSubmit={save} className="stack" noValidate>
              {err && <p className="notice notice-danger" role="alert">{err}</p>}
              <Field label="Inside Dhaka (৳)" htmlFor="sh-in" required>
                <Input id="sh-in" type="number" min="0" value={current.inside} onChange={(e) => setForm({ ...current, inside: e.target.value })} />
              </Field>
              <Field label="Outside Dhaka (৳)" htmlFor="sh-out" required>
                <Input id="sh-out" type="number" min="0" value={current.outside} onChange={(e) => setForm({ ...current, outside: e.target.value })} />
              </Field>
              <Field label="Flat rate (৳, optional)" htmlFor="sh-one">
                <Input id="sh-one" type="number" min="0" value={current.one} onChange={(e) => setForm({ ...current, one: e.target.value })} />
              </Field>
              <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save rates</Button></div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
