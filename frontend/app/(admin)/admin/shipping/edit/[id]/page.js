"use client";

/**
 * Update Shipping Cost (Zuberee parity).
 *
 * Zuberee reference: GET /dashboard/shipping/edit/:id — "Update Shipping Cost"
 * form with the same Shipping Type / cost fields as the add page.
 * Zuberee's Shipping costs page edits a rate set inline in its history table;
 * this route is the standalone Zuberee-style edit page.
 *
 * FRONTEND ONLY (backend APIs to be wired by the backend dev, no UI change needed):
 *   GET /api/admin/shipping-costs        -> rate rows (newest first); this page
 *                                           picks the row matching :id. A
 *                                           GET /api/admin/shipping-costs/:id
 *                                           single-row endpoint also works —
 *                                           the loader tries the list first.
 *   PUT /api/admin/shipping-costs/:id    <- { inside_dhaka, outside_dhaka, one_shipping_cost }
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiInfo, FiSave } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Select, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "inside_outside", label: "Inside/Outside Dhaka" },
  { value: "one", label: "One Shipping" },
];

function formFromRow(row) {
  if (!row) return { type: "inside_outside", inside_dhaka: "", outside_dhaka: "", one_shipping_cost: "" };
  const hasFlat = row.one_shipping_cost !== null && row.one_shipping_cost !== undefined && row.one_shipping_cost !== "";
  return {
    type: hasFlat ? "one" : "inside_outside",
    inside_dhaka: row.inside_dhaka ?? "",
    outside_dhaka: row.outside_dhaka ?? "",
    one_shipping_cost: hasFlat ? row.one_shipping_cost : "",
  };
}

export default function ShippingEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setFormError] = useState("");
  const [form, setForm] = useState(formFromRow(null));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = await api.get("api/admin/shipping-costs");
        const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        const row = rows.find((item) => String(item.id) === String(id));
        if (!alive) return;
        if (row) setForm(formFromRow(row));
        else setBackendReady(false);
      } catch {
        if (alive) setBackendReady(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setFormError("");

    let payload;
    if (form.type === "one") {
      const one = Number(form.one_shipping_cost);
      if (form.one_shipping_cost === "" || !Number.isFinite(one) || one < 0) {
        return setFormError("Enter the flat shipping cost (0 or more).");
      }
      payload = { inside_dhaka: one, outside_dhaka: one, one_shipping_cost: one };
    } else {
      const inside = Number(form.inside_dhaka);
      const outside = Number(form.outside_dhaka);
      if (form.inside_dhaka === "" || form.outside_dhaka === "" || !Number.isFinite(inside) || !Number.isFinite(outside) || inside < 0 || outside < 0) {
        return setFormError("Enter delivery costs for inside and outside Dhaka.");
      }
      payload = { inside_dhaka: inside, outside_dhaka: outside, one_shipping_cost: null };
    }

    setBusy(true);
    try {
      await api.put(`api/admin/shipping-costs/${id}`, payload);
      toast.success("Shipping cost updated.");
      router.push("/admin/shipping");
    } catch (err) {
      setFormError(err.message || "Shipping cost could not be saved. The backend update endpoint may not be connected yet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 720 }}>
      <AdminHeader
        eyebrow="Sales"
        title="Update Shipping Cost"
        subtitle={`Rate set #${id}. Changes only affect this row; the newest row is the active rate.`}
        actions={
          <Button variant="ghost" href="/admin/shipping">
            <FiArrowLeft aria-hidden="true" /> Shipping costs
          </Button>
        }
      />

      {!backendReady && !loading && (
        <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
          <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Frontend only for now: rate set <span className="num">#{id}</span> could not be loaded from the
            backend, so the form below starts empty. Backend dev — wire the endpoints listed in this
            file&apos;s header comment and it works unchanged.
          </span>
        </div>
      )}

      {loading ? (
        <Skeleton style={{ height: 360 }} />
      ) : (
        <Card>
          <CardHeader title="Shipping cost" subtitle="Choose a type, then enter the amounts in taka (৳)." />
          <form onSubmit={save} className="stack" noValidate>
            {error && (
              <p className="notice notice-danger" role="alert">
                {error}
              </p>
            )}

            <Field label="Shipping Type:" htmlFor="shipping-edit-type" required>
              <Select id="shipping-edit-type" name="type" value={form.type} onChange={set("type")} options={TYPE_OPTIONS} />
            </Field>

            {form.type === "inside_outside" ? (
              <>
                <Field label="Inside Dhaka Cost:" htmlFor="shipping-edit-inside" required>
                  <Input id="shipping-edit-inside" name="inside_dhaka" type="number" min="0" value={form.inside_dhaka} onChange={set("inside_dhaka")} placeholder="Enter cost for Inside Dhaka" />
                </Field>
                <Field label="Outside Dhaka Cost:" htmlFor="shipping-edit-outside" required>
                  <Input id="shipping-edit-outside" name="outside_dhaka" type="number" min="0" value={form.outside_dhaka} onChange={set("outside_dhaka")} placeholder="Enter cost for Outside Dhaka" />
                </Field>
              </>
            ) : (
              <Field label="Shipping Cost: (Applicable For All District)" htmlFor="shipping-edit-one" required>
                <Input id="shipping-edit-one" name="one_shipping_cost" type="number" min="0" value={form.one_shipping_cost} onChange={set("one_shipping_cost")} placeholder="Enter shipping cost" />
              </Field>
            )}

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Link href="/admin/shipping" className="btn btn-ghost">
                Cancel
              </Link>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                <FiSave aria-hidden="true" /> Save changes
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
