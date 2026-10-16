"use client";

import { useState } from "react";
import { FiEdit2, FiInfo, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * Shipping rates are versioned rows on the backend:
 *   GET    /api/admin/shipping-costs-latest  -> DIRECT object { id, inside_dhaka, outside_dhaka, one_shipping_cost, ... }
 *   GET    /api/admin/shipping-costs         -> { data: [ ...rows, newest first ] }
 *   POST   /api/admin/shipping-costs         <- create a new row (201)
 *   PUT    /api/admin/shipping-costs/:id     <- partial update of one row
 *   DELETE /api/admin/shipping-costs/:id     -> 409 when it is the only remaining entry
 */
const EMPTY_FORM = { inside: "", outside: "", one: "" };

export default function ShippingPage() {
  const { toast, confirm } = useFeedback();
  const latest = useAsync(() => api.get("api/admin/shipping-costs-latest").then((b) => b.data || b), []);
  const history = useAsync(async () => {
    const body = await api.get("api/admin/shipping-costs");
    return Array.isArray(body.data) ? body.data : [];
  }, []);

  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const current = latest.data;
  const rows = history.data || [];
  const values = form ?? { inside: "", outside: "", one: "" };

  const reloadAll = () => {
    latest.reload();
    history.reload();
  };

  const startEdit = (row) => {
    setErr("");
    setEditingId(row.id);
    setForm({
      inside: String(row.inside_dhaka ?? ""),
      outside: String(row.outside_dhaka ?? ""),
      one: row.one_shipping_cost === null || row.one_shipping_cost === undefined ? "" : String(row.one_shipping_cost),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
    setErr("");
  };

  const validate = () => {
    const inside = Number(values.inside);
    const outside = Number(values.outside);
    if (values.inside === "" || values.outside === "" || !Number.isFinite(inside) || !Number.isFinite(outside) || inside < 0 || outside < 0) {
      setErr("Enter delivery costs for inside and outside Dhaka.");
      return null;
    }
    const one = values.one === "" ? null : Number(values.one);
    if (one !== null && (!Number.isFinite(one) || one < 0)) {
      setErr("The flat rate must be a number of 0 or more, or left blank.");
      return null;
    }
    return { inside_dhaka: inside, outside_dhaka: outside, one_shipping_cost: one };
  };

  const save = async (event) => {
    event.preventDefault();
    setErr("");
    const payload = validate();
    if (!payload) return;
    setBusy(true);
    try {
      if (editingId) {
        await api.put(`api/admin/shipping-costs/${editingId}`, payload);
        toast.success("Shipping cost updated.");
      } else {
        await api.post("api/admin/shipping-costs", payload);
        toast.success("New shipping rates saved. They apply to new orders from now on.");
      }
      cancelEdit();
      reloadAll();
    } catch (e) {
      toast.error(e.message || "Shipping costs could not be saved.");
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: "Delete this rate set?",
      message: `${formatMoney(row.inside_dhaka)} inside / ${formatMoney(row.outside_dhaka)} outside Dhaka will be removed from the history.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`api/admin/shipping-costs/${row.id}`);
      toast.success("Shipping cost deleted.");
      if (editingId === row.id) cancelEdit();
      reloadAll();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 1080 }}>
      <AdminHeader eyebrow="Sales" title="Shipping costs" subtitle="Default delivery charges for inside and outside Dhaka." />

      <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
        <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          These rates are live on the storefront: checkout quotes the delivery charge for the district the shopper selects, and every new order stores the fee. Rates are versioned — saving creates a new row, and the newest row (by creation time) is the one the storefront uses.
        </span>
      </div>

      {latest.error ? <ErrorState message={latest.error} onRetry={latest.reload} /> : latest.loading ? <Skeleton style={{ height: 200 }} /> : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Card>
            <CardHeader title="Currently applied" subtitle={current?.created_at ? `Saved ${formatDateTime(current.created_at)}` : "Not set yet"} />
            <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Stat label="Inside Dhaka" value={current?.inside_dhaka != null ? formatMoney(current.inside_dhaka) : "—"} tone="brand" />
              <Stat label="Outside Dhaka" value={current?.outside_dhaka != null ? formatMoney(current.outside_dhaka) : "—"} tone="info" />
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Flat rate: {current?.one_shipping_cost != null ? formatMoney(current.one_shipping_cost) : "not set"}
            </p>
          </Card>

          <Card>
            <CardHeader
              title={editingId ? `Edit rate set #${editingId}` : "Add new rates"}
              subtitle={editingId ? "Changes only affect this historical row." : "Creates a new row that becomes the active rate."}
              actions={editingId ? <Button variant="ghost" size="sm" onClick={cancelEdit}><FiX aria-hidden="true" /> Cancel</Button> : null}
            />
            <form onSubmit={save} className="stack" noValidate>
              {err && <p className="notice notice-danger" role="alert">{err}</p>}
              <Field label="Inside Dhaka (৳)" htmlFor="sh-in" required>
                <Input id="sh-in" type="number" min="0" value={values.inside} onChange={(e) => setForm({ ...values, inside: e.target.value })} />
              </Field>
              <Field label="Outside Dhaka (৳)" htmlFor="sh-out" required>
                <Input id="sh-out" type="number" min="0" value={values.outside} onChange={(e) => setForm({ ...values, outside: e.target.value })} />
              </Field>
              <Field label="Flat rate (৳, optional)" htmlFor="sh-one" hint="When set, this single charge applies to every district.">
                <Input id="sh-one" type="number" min="0" value={values.one} onChange={(e) => setForm({ ...values, one: e.target.value })} />
              </Field>
              <div>
                <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                  {editingId ? "Save changes" : <><FiPlus aria-hidden="true" /> Publish new rates</>}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : history.loading || !history.data ? <Skeleton style={{ height: 240 }} /> : rows.length === 0 ? (
        <EmptyState title="No rate history" text="Publish your first rate set above and it will appear here." />
      ) : (
        <Card>
          <CardHeader title="Rate history" subtitle={`${rows.length} version${rows.length === 1 ? "" : "s"}, newest first`} />
          <DataTable>
            <thead>
              <tr>
                <th style={{ width: 80 }}>#</th>
                <th className="text-right">Inside Dhaka</th>
                <th className="text-right">Outside Dhaka</th>
                <th className="text-right">Flat rate</th>
                <th>Created</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="num">{row.id}{index === 0 ? <span className="badge badge-success" style={{ marginLeft: 8 }}>Active</span> : null}</td>
                  <td className="text-right num">{formatMoney(row.inside_dhaka)}</td>
                  <td className="text-right num">{formatMoney(row.outside_dhaka)}</td>
                  <td className="text-right num">{row.one_shipping_cost == null ? "—" : formatMoney(row.one_shipping_cost)}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.created_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" className="icon-btn" aria-label={`Edit rate set ${row.id}`} onClick={() => startEdit(row)}><FiEdit2 aria-hidden="true" /></button>
                      <button type="button" className="icon-btn" aria-label={`Delete rate set ${row.id}`} onClick={() => remove(row)} disabled={rows.length <= 1} title={rows.length <= 1 ? "The backend refuses to delete the only remaining rate set." : undefined}><FiTrash2 aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      )}
    </div>
  );
}
