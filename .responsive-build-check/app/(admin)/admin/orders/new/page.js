"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FiArrowLeft, FiPlus, FiTrash2 } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, ErrorState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, isValidBdPhone, isValidEmail, normalizeEmail, normalizePhone } from "@/lib/api";
import { DISTRICTS } from "@/lib/districts";
import { useAsync } from "@/lib/useAsync";

/**
 * Manual order entry for phone / walk-in customers.
 *
 * Backend contract (backend/app/api/admin/orders/route.js — POST handler, ADMIN only):
 *   POST /api/admin/orders
 *     { guestName, guestPhone, guestEmail, guestAddress, shippingAddress, district,
 *       shippingFee, advancePayment, paymentMethod, items: [{ productId, quantity }] }
 *   -> 201 { success, message: "Order created successfully.", data: <formatted order> }
 *   - omitting `userId` makes the backend create a guest order and require a valid guestName, guestPhone and guestEmail;
 *   - shippingFee, advancePayment and paymentMethod default to 0 / 0 / "cash" on the backend;
 *   - the backend ignores any client price: each line is priced from the product row
 *     (`discount` when it is set, otherwise `price`) inside a transaction that also decrements stock.
 *
 * Reference data comes from the two admin-gated order helpers that no other screen used before:
 *   GET /api/order-districts        -> { data: ["dhaka", ...] }        (districts seen on real orders)
 *   GET /api/order-product-options  -> { data: [{ id, title, sku }] }  (products that can be ordered)
 */

const EMPTY_LINE = { productId: "", quantity: "1" };

function districtOptionsFrom(apiDistricts) {
  const seen = new Set(DISTRICTS.map((d) => d.value));
  const extras = (Array.isArray(apiDistricts) ? apiDistricts : [])
    .map((d) => String(d || "").trim().toLowerCase())
    .filter((d) => d && !seen.has(d))
    .map((d) => ({ value: d, label: d.replace(/\b\w/g, (c) => c.toUpperCase()) }));
  return [...DISTRICTS, ...extras].sort((a, b) => a.label.localeCompare(b.label));
}

export default function CreateOrderPage() {
  const { toast } = useFeedback();

  const reference = useAsync(
    () =>
      Promise.all([
        api.get("api/order-product-options").then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => []),
        api.get("api/order-districts").then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => []),
        api.get("api/admin/shipping-costs-latest").then((b) => b.data || b).catch(() => null),
      ]).then(([products, districts, rates]) => ({ products, districts, rates })),
    []
  );

  const products = reference.data?.products || [];
  const rateRow = reference.data?.rates || null;
  const districtOptions = useMemo(() => districtOptionsFrom(reference.data?.districts), [reference.data]);

  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", district: "", fee: "", advance: "" });
  const [feeTouched, setFeeTouched] = useState(false);
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Keep the delivery fee in step with the district until the admin types one themselves.
      if (key === "district" && !feeTouched && rateRow) {
        const inside = rateRow.inside_dhaka ?? rateRow.insideDhaka;
        const outside = rateRow.outside_dhaka ?? rateRow.outsideDhaka;
        const fee = value === "dhaka" ? inside : outside;
        next.fee = fee === null || fee === undefined ? "" : String(Number(fee));
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const setLine = (index, key) => (event) => {
    const value = event.target.value;
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
    setErrors((current) => ({ ...current, items: "" }));
  };

  const addLine = () => setLines((current) => [...current, { ...EMPTY_LINE }]);
  const removeLine = (index) => setLines((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));

  const productLabel = (line) => {
    const product = products.find((p) => String(p.id) === String(line.productId));
    return product ? `${product.title || `Product ${product.id}`}${product.sku ? ` · ${product.sku}` : ""}` : "";
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Enter the customer name.";
    const phone = normalizePhone(form.phone);
    if (!phone) next.phone = "Enter the customer phone number.";
    else if (!isValidBdPhone(phone)) next.phone = "Enter a valid Bangladeshi mobile number (e.g. 01712345678).";
    const email = normalizeEmail(form.email);
    if (!email) next.email = "Enter the customer email address.";
    else if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    if (!form.address.trim()) next.address = "Enter the delivery address.";
    if (!form.district) next.district = "Choose the delivery district.";
    const fee = form.fee === "" ? 0 : Number(form.fee);
    if (!Number.isFinite(fee) || fee < 0) next.fee = "The delivery fee must be 0 or more.";
    const advance = form.advance === "" ? 0 : Number(form.advance);
    if (!Number.isFinite(advance) || advance < 0) next.advance = "The advance payment must be 0 or more.";
    const items = lines.filter((line) => line.productId);
    if (!items.length) next.items = "Add at least one product to the order.";
    else if (items.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
      next.items = "Every line needs a whole quantity of 1 or more.";
    }
    setErrors(next);
    return Object.keys(next).length ? null : { fee, advance, items, phone, email };
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return; // never fire twice from a double click
    const payload = validate();
    if (!payload) return;
    setBusy(true);
    try {
      const body = await api.post("api/admin/orders", {
        guestName: form.name.trim(),
        guestPhone: payload.phone,
        guestEmail: payload.email,
        contactName: form.name.trim(),
        contactPhone: payload.phone,
        contactEmail: payload.email,
        phone: payload.phone,
        email: payload.email,
        guestAddress: form.address.trim(),
        shippingAddress: form.address.trim(),
        district: form.district,
        shippingFee: payload.fee,
        advancePayment: payload.advance,
        paymentMethod: "cash",
        items: payload.items.map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity) })),
      });
      const order = body.data || null;
      setCreated(order);
      toast.success(order?.order_number ? `Order ${order.order_number} created.` : "Order created.");
      setForm({ name: "", phone: "", email: "", address: "", district: "", fee: "", advance: "" });
      setFeeTouched(false);
      setLines([{ ...EMPTY_LINE }]);
    } catch (err) {
      toast.error(err.message || "The order could not be created.");
      setErrors({ submit: err.message || "The order could not be created." });
    } finally {
      setBusy(false);
    }
  };

  if (reference.loading) {
    return (
      <div className="stack" style={{ gap: "1.25rem", maxWidth: 1080 }}>
        <AdminHeader eyebrow="Sales" title="Create order" subtitle="Loading products and districts…" />
        <Skeleton style={{ height: 260 }} />
        <Skeleton style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 1080 }}>
      <AdminHeader
        eyebrow="Sales"
        title="Create order"
        subtitle="Record a phone or walk-in order. Stock is reduced when the order is created."
        actions={
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            <FiArrowLeft aria-hidden="true" /> Back to orders
          </Link>
        }
      />

      {reference.error && <ErrorState message={reference.error} onRetry={reference.reload} />}

      {products.length === 0 && (
        <p className="muted" role="status">
          No products are available to order yet. Add a product first, then reload this page.
        </p>
      )}

      {created && (
        <Card>
          <CardHeader title="Order created" subtitle={created.order_number ? `${created.order_number} · ${formatMoney(created.total)}` : "The order was saved."} />
          <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {created.id && (
              <>
                <Link href={`/admin/orders/${created.id}`} className="btn btn-primary btn-sm">Open order</Link>
                <Link href={`/admin/orders/invoice/${created.id}`} className="btn btn-ghost btn-sm">Invoice</Link>
              </>
            )}
            <Button variant="ghost" onClick={() => setCreated(null)}>Hide</Button>
          </div>
        </Card>
      )}

      <form className="stack" style={{ gap: "1.25rem" }} onSubmit={submit} noValidate>
        <Card>
          <CardHeader title="Customer" subtitle="Guest orders use the name, phone and email entered here." />
          <div className="grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))" }}>
            <Field label="Full name" htmlFor="co-name" required error={errors.name}>
              <Input id="co-name" value={form.name} onChange={set("name")} autoComplete="name" aria-invalid={!!errors.name} />
            </Field>
            <Field label="Phone" htmlFor="co-phone" required error={errors.phone} hint="Used by the courier, and required to track the order.">
              <Input id="co-phone" value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" aria-invalid={!!errors.phone} required />
            </Field>
            <Field label="Email" htmlFor="co-email" required error={errors.email} hint="Required for order confirmation and updates.">
              <Input id="co-email" type="email" value={form.email} onChange={set("email")} inputMode="email" autoComplete="email" placeholder="customer@example.com" aria-invalid={!!errors.email} required />
            </Field>
            <Field label="District" htmlFor="co-district" required error={errors.district}>
              <Select id="co-district" value={form.district} onChange={set("district")} placeholder="Choose a district" options={districtOptions} />
            </Field>
            <Field label="Delivery fee (৳)" htmlFor="co-fee" error={errors.fee} hint={rateRow ? "Prefilled from the current shipping rates; edit if this order differs." : "The current shipping rates could not be loaded — enter the fee yourself."}>
              <Input id="co-fee" value={form.fee} onChange={(e) => { setFeeTouched(true); set("fee")(e); }} inputMode="decimal" aria-invalid={!!errors.fee} />
            </Field>
            <Field label="Advance payment (৳)" htmlFor="co-advance" error={errors.advance} hint="Optional. Recorded on the order, not charged here.">
              <Input id="co-advance" value={form.advance} onChange={set("advance")} inputMode="decimal" aria-invalid={!!errors.advance} />
            </Field>
          </div>
          <Field label="Delivery address" htmlFor="co-address" required error={errors.address} hint="House, road, area and landmark.">
            <Textarea id="co-address" rows={3} value={form.address} onChange={set("address")} aria-invalid={!!errors.address} />
          </Field>
          <p className="muted" style={{ fontSize: "0.88rem", marginBottom: 0 }}>
            Payment method: <strong>Cash on delivery</strong> — the storefront collects no online payment, so the backend stores
            <code> paymentMethod: &quot;cash&quot;</code>.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Products"
            subtitle="The backend prices each line from the product row (its discount price when one is set)."
            actions={<Button variant="ghost" size="sm" onClick={addLine} type="button"><FiPlus aria-hidden="true" /> Add line</Button>}
          />
          {errors.items && <p className="field-error" role="alert">{errors.items}</p>}
          <div className="stack" style={{ gap: 10 }}>
            {lines.map((line, index) => (
              <div key={index} className="row" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px" }}>
                  <Field label={index === 0 ? "Product" : `Product ${index + 1}`} htmlFor={`co-product-${index}`}>
                    <Select
                      id={`co-product-${index}`}
                      value={line.productId}
                      onChange={setLine(index, "productId")}
                      placeholder={products.length ? "Choose a product" : "No products available"}
                      options={products.map((p) => ({ value: String(p.id), label: `${p.title || `Product ${p.id}`}${p.sku ? ` · ${p.sku}` : ""}` }))}
                    />
                  </Field>
                </div>
                <div style={{ flex: "0 1 120px" }}>
                  <Field label="Quantity" htmlFor={`co-qty-${index}`}>
                    <Input id={`co-qty-${index}`} value={line.quantity} onChange={setLine(index, "quantity")} inputMode="numeric" />
                  </Field>
                </div>
                <div style={{ paddingBottom: 10 }}>
                  <Button variant="ghost" size="sm" type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} aria-label={`Remove line ${index + 1}`}>
                    <FiTrash2 aria-hidden="true" />
                  </Button>
                </div>
                {productLabel(line) && <p className="muted" style={{ flex: "1 1 100%", margin: 0, fontSize: "0.85rem" }}>{productLabel(line)}</p>}
              </div>
            ))}
          </div>
        </Card>

        {errors.submit && <p className="form-error" role="alert">{errors.submit}</p>}

        <div className="row" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/admin/orders" className="btn btn-ghost">Cancel</Link>
          <Button variant="primary" type="submit" disabled={busy || products.length === 0}>
            {busy ? "Creating order…" : "Create order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
