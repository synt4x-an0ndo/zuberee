"use client";

/**
 * Add Shipping Cost (Zuberee parity).
 *
 * Zuberee reference: GET /dashboard/shipping/add — "Add Shipping Cost" form with
 * Shipping Type (Inside/Outside Dhaka | One Shipping), Inside Dhaka Cost,
 * Outside Dhaka Cost, and "Shipping Cost: (Applicable For All District)".
 * Zuberee's Shipping costs page creates a rate set with an inline form; this
 * route is the standalone Zuberee-style page.
 *
 * FRONTEND ONLY (backend API to be wired by the backend dev, no UI change needed):
 *   POST /api/admin/shipping-costs
 *     Inside/Outside mode <- { inside_dhaka, outside_dhaka, one_shipping_cost: null }
 *     One Shipping mode   <- { inside_dhaka, outside_dhaka, one_shipping_cost }
 * That is the exact create call Admin -> Shipping costs already makes.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiArrowLeft, FiInfo, FiPlus } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "inside_outside", label: "Inside/Outside Dhaka" },
  { value: "one", label: "One Shipping" },
];

export default function ShippingAddPage() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setFormError] = useState("");
  const [form, setForm] = useState({ type: "inside_outside", inside_dhaka: "", outside_dhaka: "", one_shipping_cost: "" });

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
      // A flat rate still needs inside/outside values for the current rate-set
      // contract; they are stored but the flat rate is what checkout quotes.
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
      await api.post("api/admin/shipping-costs", payload);
      toast.success("Shipping cost added. It applies to new orders from now on.");
      router.push("/admin/shipping");
    } catch (err) {
      setFormError(err.message || "Shipping cost could not be saved. The backend create endpoint may not be connected yet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 720 }}>
      <AdminHeader
        eyebrow="Sales"
        title="Add Shipping Cost"
        subtitle="Set the delivery charges the storefront quotes at checkout."
        actions={
          <Button variant="ghost" href="/admin/shipping">
            <FiArrowLeft aria-hidden="true" /> Shipping costs
          </Button>
        }
      />

      <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
        <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          Frontend only for now. Backend dev — this form posts to{" "}
          <span className="num">POST /api/admin/shipping-costs</span>, the same endpoint Admin -&gt; Shipping
          costs uses. Rates are versioned: saving creates a new row that becomes the active rate.
        </span>
      </div>

      <Card>
        <CardHeader title="Shipping cost" subtitle="Choose a type, then enter the amounts in taka (৳)." />
        <form onSubmit={save} className="stack" noValidate>
          {error && (
            <p className="notice notice-danger" role="alert">
              {error}
            </p>
          )}

          <Field label="Shipping Type:" htmlFor="shipping-add-type" required>
            <Select id="shipping-add-type" name="type" value={form.type} onChange={set("type")} options={TYPE_OPTIONS} />
          </Field>

          {form.type === "inside_outside" ? (
            <>
              <Field label="Inside Dhaka Cost:" htmlFor="shipping-add-inside" required>
                <Input id="shipping-add-inside" name="inside_dhaka" type="number" min="0" value={form.inside_dhaka} onChange={set("inside_dhaka")} placeholder="Enter cost for Inside Dhaka" />
              </Field>
              <Field label="Outside Dhaka Cost:" htmlFor="shipping-add-outside" required>
                <Input id="shipping-add-outside" name="outside_dhaka" type="number" min="0" value={form.outside_dhaka} onChange={set("outside_dhaka")} placeholder="Enter cost for Outside Dhaka" />
              </Field>
            </>
          ) : (
            <Field label="Shipping Cost: (Applicable For All District)" htmlFor="shipping-add-one" required>
              <Input id="shipping-add-one" name="one_shipping_cost" type="number" min="0" value={form.one_shipping_cost} onChange={set("one_shipping_cost")} placeholder="Enter shipping cost" />
            </Field>
          )}

          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Link href="/admin/shipping" className="btn btn-ghost">
              Cancel
            </Link>
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              <FiPlus aria-hidden="true" /> Add Shipping Cost
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
