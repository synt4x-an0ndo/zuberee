"use client";

/**
 * Edit order. Saving sends one PATCH to `api/admin/orders/:id` containing
 * status/payment, customer contact and delivery details, courier, charges,
 * notes and items. The response is compared with the submitted values; if a
 * future API change causes a field not to persist, the page keeps the draft
 * and names the affected section instead of reporting a false success.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FiArrowLeft, FiPlus, FiSave, FiTrash2, FiPrinter } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, ErrorState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, isValidBdPhone, isValidEmail, normalizeEmail, normalizePhone, request } from "@/lib/api";
import { COURIER_OPTIONS, courierOptionsWith } from "@/lib/couriers";
import { DISTRICTS } from "@/lib/districts";
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, formatOrderNumber, orderStatusMeta } from "@/lib/format";
import { getInvoiceData } from "@/lib/orderInvoice";
import { useAsync } from "@/lib/useAsync";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash on Delivery" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank Transfer" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
];

const moneyInput = (value) => (value === "" || value === null || value === undefined ? "" : String(Math.round(Number(value) || 0)));

function districtOptions(current) {
  const options = DISTRICTS.map((d) => ({ value: d.label, label: d.label }));
  if (current && !options.some((o) => o.value.toLowerCase() === String(current).toLowerCase())) {
    options.unshift({ value: current, label: current });
  }
  return options;
}

function formFromOrder(order) {
  const inv = getInvoiceData(order);
  return {
    name: inv.customer.name || "",
    phone: inv.customer.phone || "",
    email: inv.customer.email || "",
    address: inv.customer.address || "",
    district: inv.customer.district || "",
    status: String(order.status || "pending").toLowerCase(),
    paymentStatus: String(order.payment_status || "pending").toLowerCase(),
    paymentMethod: inv.paymentMethod || "cash",
    courier: inv.courier || "",
    shippingCost: moneyInput(inv.shipping),
    advancePayment: moneyInput(inv.advance),
    deliveryNotes: inv.deliveryNotes || "",
    items: inv.items.map((item) => ({
      key: String(item.key),
      id: typeof item.key === "number" ? item.key : null,
      product_id: item.productId,
      variant_id: item.variantId ?? null,
      title: item.title,
      sku: item.sku || "",
      size: item.size || "",
      variant: item.variant || "",
      qty: String(item.qty),
      unitPrice: moneyInput(item.unitPrice),
    })),
  };
}

export default function AdminOrderEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const { data: order, loading, error, reload } = useAsync(() => api.get(`api/admin/orders/${id}`).then((b) => b.data), [id]);
  const { data: productOptions } = useAsync(
    () => api.get("api/admin/orders/product-options").then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => []),
    []
  );
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductQty, setNewProductQty] = useState("1");

  const form = draft ?? (order ? formFromOrder(order) : null);
  const set = (key) => (e) => setDraft({ ...form, [key]: e.target.value });

  const totals = useMemo(() => {
    if (!form) return { itemsTotal: 0, shipping: 0, advance: 0, total: 0, due: 0 };
    const itemsTotal = form.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
    const shipping = Number(form.shippingCost) || 0;
    const advance = Number(form.advancePayment) || 0;
    const total = itemsTotal + shipping;
    const settled = form.paymentStatus === "paid" || form.paymentStatus === "refunded";
    return { itemsTotal, shipping, advance, total, due: settled ? 0 : Math.max(0, total - advance) };
  }, [form]);

  if (loading) {
    return <div className="stack"><Skeleton style={{ height: 40, width: 260 }} /><Skeleton style={{ height: 420 }} /></div>;
  }
  if (error || !order || !form) {
    return <ErrorState message={error || "Order not found."} onRetry={reload} />;
  }

  const original = formFromOrder(order);
  const itemsChanged = JSON.stringify(original.items.map((i) => [i.id, i.product_id, i.variant_id, i.qty, i.unitPrice, i.size])) !== JSON.stringify(form.items.map((i) => [i.id, i.product_id, i.variant_id, i.qty, i.unitPrice, i.size]));
  const extendedChanged =
    form.name !== original.name || form.phone !== original.phone || form.email !== original.email ||
    form.address !== original.address || form.district !== original.district ||
    form.paymentMethod !== original.paymentMethod || form.courier !== original.courier ||
    form.shippingCost !== original.shippingCost || form.advancePayment !== original.advancePayment ||
    form.deliveryNotes !== original.deliveryNotes || itemsChanged;
  const statusChanged = form.status !== original.status;
  const paymentChanged = form.paymentStatus !== original.paymentStatus;
  const dirty = extendedChanged || statusChanged || paymentChanged;

  const patchItem = (key, field, value) => setDraft({ ...form, items: form.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)) });
  const removeItem = async (item) => {
    const ok = await confirm({ title: "Remove this item?", message: `"${item.title}" will be removed from the order when you save.`, confirmText: "Remove item", danger: true });
    if (ok) setDraft({ ...form, items: form.items.filter((row) => row.key !== item.key) });
  };
  const addProduct = () => {
    const product = (productOptions || []).find((p) => String(p.id) === String(newProductId));
    if (!product) return setFormError("Choose a product to add first.");
    setFormError("");
    setDraft({
      ...form,
      items: [...form.items, {
        key: `new-${product.id}-${Date.now()}`,
        id: null,
        product_id: product.id,
        variant_id: null,
        title: product.title || product.name || "Product",
        sku: product.sku || "",
        size: "",
        variant: "",
        qty: String(Math.max(1, Number(newProductQty) || 1)),
        unitPrice: moneyInput(newProductPrice),
      }],
    });
    setNewProductId("");
    setNewProductPrice("");
    setNewProductQty("1");
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError("");
    setSaveNote("");
    if (!form.name.trim()) return setFormError("Customer name is required.");
    const submittedPhone = normalizePhone(form.phone);
    if (!submittedPhone) return setFormError("Customer phone is required.");
    if (submittedPhone !== normalizePhone(original.phone) && !isValidBdPhone(submittedPhone)) {
      return setFormError("Enter a valid Bangladeshi mobile number (01XXXXXXXXX).");
    }
    const submittedEmail = normalizeEmail(form.email);
    if (!submittedEmail && normalizeEmail(original.email)) return setFormError("Customer email cannot be cleared.");
    if (submittedEmail && submittedEmail !== normalizeEmail(original.email) && !isValidEmail(submittedEmail)) {
      return setFormError("Enter a valid email address.");
    }
    if (!form.address.trim()) return setFormError("Delivery address is required.");
    if (form.items.length === 0) return setFormError("An order needs at least one item. Add a product before saving.");
    if (form.items.some((item) => !(Number(item.qty) >= 1) || !(Number(item.unitPrice) >= 0))) return setFormError("Every item needs a quantity of at least 1 and a price of 0 or more.");
    if (totals.advance > totals.total) return setFormError("Advance payment cannot be more than the order total.");

    if (statusChanged && form.status === "cancelled") {
      const ok = await confirm({ title: "Cancel this order?", message: "The customer will see it as cancelled.", confirmText: "Cancel order", danger: true });
      if (!ok) return;
    }

    const submitted = {
      ...form,
      name: form.name.trim(),
      phone: submittedPhone,
      email: submittedEmail,
      address: form.address.trim(),
      deliveryNotes: form.deliveryNotes.trim(),
    };

    const body = {
      status: submitted.status.toUpperCase(),
      paymentStatus: submitted.paymentStatus.toUpperCase(),
      courier_entry: submitted.courier,
      name: submitted.name,
      phone: submitted.phone,
      email: submitted.email,
      address: submitted.address,
      district: submitted.district,
      payment_method: submitted.paymentMethod,
      shipping_cost: Number(submitted.shippingCost) || 0,
      advance_payment: Number(submitted.advancePayment) || 0,
      delivery_notes: submitted.deliveryNotes,
      items: submitted.items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id || undefined,
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        size: item.size || undefined,
      })),
    };

    const textMismatch = (savedValue, submittedValue) => String(savedValue ?? "").trim() !== String(submittedValue ?? "").trim();
    const lowerMismatch = (savedValue, submittedValue) => String(savedValue ?? "").trim().toLowerCase() !== String(submittedValue ?? "").trim().toLowerCase();
    const moneyMismatch = (savedValue, submittedValue) => Math.abs((Number(savedValue) || 0) - (Number(submittedValue) || 0)) > 0.005;
    // Variant/size are checked separately below: older rows may gain a
    // backfilled variant (and therefore a derived size) during this save.
    const itemSignature = (items) => items
      .map((item) => [Number(item.product_id) || 0, Number(item.qty) || 0, Number(item.unitPrice) || 0].join("|"))
      .sort()
      .join("||");

    setSaving(true);
    try {
      const res = await request(`api/admin/orders/${id}`, { method: "PATCH", body });
      const saved = res?.data ? formFromOrder(res.data) : null;
      if (!saved) {
        setSaveNote("The order could not be verified after saving. Your entered values are still shown; reload the order before trying again.");
        toast.info("Saved changes could not be verified.");
        reload();
        return;
      }

      const unsaved = [];
      if (statusChanged && lowerMismatch(saved.status, submitted.status)) unsaved.push("order status");
      if (paymentChanged && lowerMismatch(saved.paymentStatus, submitted.paymentStatus)) unsaved.push("payment status");

      const customerChanged =
        textMismatch(submitted.name, original.name) ||
        normalizePhone(submitted.phone) !== normalizePhone(original.phone) ||
        normalizeEmail(submitted.email) !== normalizeEmail(original.email) ||
        textMismatch(submitted.address, original.address) ||
        lowerMismatch(submitted.district, original.district);
      const customerMismatch =
        textMismatch(saved.name, submitted.name) ||
        normalizePhone(saved.phone) !== normalizePhone(submitted.phone) ||
        normalizeEmail(saved.email) !== normalizeEmail(submitted.email) ||
        textMismatch(saved.address, submitted.address) ||
        lowerMismatch(saved.district, submitted.district);
      if (customerChanged && customerMismatch) unsaved.push("customer details");

      if (submitted.paymentMethod !== original.paymentMethod && lowerMismatch(saved.paymentMethod, submitted.paymentMethod)) unsaved.push("payment method");
      if (submitted.courier !== original.courier && textMismatch(saved.courier, submitted.courier)) unsaved.push("courier assignment");
      if ((moneyMismatch(submitted.shippingCost, original.shippingCost) && moneyMismatch(saved.shippingCost, submitted.shippingCost)) ||
          (moneyMismatch(submitted.advancePayment, original.advancePayment) && moneyMismatch(saved.advancePayment, submitted.advancePayment))) {
        unsaved.push("charges");
      }
      if (submitted.deliveryNotes !== original.deliveryNotes && textMismatch(saved.deliveryNotes, submitted.deliveryNotes)) unsaved.push("delivery notes");
      const originalItemsById = new Map(original.items.filter((item) => item.id).map((item) => [item.id, item]));
      const savedItemsById = new Map(saved.items.filter((item) => item.id).map((item) => [item.id, item]));
      const sizeUnsaved = submitted.items.some((item) => {
        if (!item.id) return false;
        const submittedSize = String(item.size || "").trim().toLowerCase();
        const originalSize = String(originalItemsById.get(item.id)?.size || "").trim().toLowerCase();
        const savedItem = savedItemsById.get(item.id);
        const savedSize = String(savedItem?.size || savedItem?.variant || "").trim().toLowerCase();
        return Boolean(submittedSize && submittedSize !== originalSize && savedSize !== submittedSize);
      });
      if ((itemsChanged && itemSignature(saved.items) !== itemSignature(submitted.items)) || sizeUnsaved) unsaved.push("items");

      if (unsaved.length) {
        setSaveNote(`Some changes could not be saved: ${unsaved.join(", ")}. Your entered values are still shown so you can review them.`);
        toast.info("Some changes could not be saved.");
        reload();
        return;
      }

      setDraft(null);
      toast.success("Order saved.");
      router.push(`/admin/orders/${id}`);
    } catch (err) {
      setFormError(err.message || "The order could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" style={{ gap: "1.25rem" }} onSubmit={save}>
      <Link href={`/admin/orders/${id}`} className="link-arrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FiArrowLeft aria-hidden="true" /> Back to order {formatOrderNumber(order)}
      </Link>

      <AdminHeader
        eyebrow={`Edit order · placed by ${original.name || "Guest"}`}
        title={`Edit ${formatOrderNumber(order)}`}
        subtitle="Update customer, items and charges. Totals recalculate as you type."
        actions={(
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button as={Link} href={`/admin/orders/invoice/${id}`} variant="outline" icon={FiPrinter}>Invoice</Button>
            <Button type="submit" variant="primary" icon={FiSave} loading={saving} disabled={!dirty}>Save changes</Button>
          </div>
        )}
      />

      {saveNote && <p className="notice notice-warn" role="status" style={{ margin: 0 }}>{saveNote}</p>}
      {formError && <p className="notice notice-danger" role="alert" style={{ margin: 0 }}>{formError}</p>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Customer & delivery" />
            <div className="stack" style={{ padding: "0 1.25rem 1.25rem" }}>
              <Field label="Customer name" htmlFor="eo-name" required><Input id="eo-name" value={form.name} onChange={set("name")} /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Phone" htmlFor="eo-phone" required><Input id="eo-phone" className="num" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} /></Field>
                <Field label="Email" htmlFor="eo-email" hint="Must be valid if entered."><Input id="eo-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
              </div>
              <Field label="Address" htmlFor="eo-address" required><Textarea id="eo-address" rows={2} value={form.address} onChange={set("address")} /></Field>
              <Field label="District" htmlFor="eo-district">
                <Select id="eo-district" placeholder="Select district" options={districtOptions(form.district)} value={districtOptions(form.district).find((o) => o.value.toLowerCase() === String(form.district).toLowerCase())?.value || form.district} onChange={set("district")} />
              </Field>
              <Field label="Delivery notes" htmlFor="eo-notes"><Textarea id="eo-notes" rows={2} value={form.deliveryNotes} onChange={set("deliveryNotes")} placeholder="e.g. Call before delivery" /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Items" subtitle="Quantities and prices recalculate the order total." />
            <div className="stack" style={{ padding: "0 1.25rem 1.25rem" }}>
              {form.items.map((item, index) => (
                <div key={item.key} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                      <span className="muted">{index + 1}. </span>{item.title}
                      {item.sku && <span className="muted num" style={{ display: "block", fontSize: "0.8rem", fontWeight: 500 }}>{item.sku}</span>}
                      {item.variant && <span className="muted" style={{ display: "block", fontSize: "0.82rem", fontWeight: 500 }}>{item.variant}</span>}
                    </p>
                    <Button type="button" variant="ghost" size="sm" icon={FiTrash2} onClick={() => removeItem(item)}>Remove</Button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
                    <Field label="Size / variant" htmlFor={`eo-size-${item.key}`}><Input id={`eo-size-${item.key}`} value={item.size} onChange={(e) => patchItem(item.key, "size", e.target.value)} placeholder="—" /></Field>
                    <Field label="Qty" htmlFor={`eo-qty-${item.key}`}><Input id={`eo-qty-${item.key}`} type="number" min="1" step="1" className="num" value={item.qty} onChange={(e) => patchItem(item.key, "qty", e.target.value)} /></Field>
                    <Field label="Unit price (BDT)" htmlFor={`eo-price-${item.key}`}><Input id={`eo-price-${item.key}`} type="number" min="0" step="1" className="num" value={item.unitPrice} onChange={(e) => patchItem(item.key, "unitPrice", e.target.value)} /></Field>
                  </div>
                  <p className="num" style={{ margin: 0, textAlign: "right" }}>Line total: <strong>{formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</strong></p>
                </div>
              ))}

              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14, display: "grid", gap: 10 }}>
                <strong>Add product</strong>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <Field label="Product" htmlFor="eo-add-product">
                    <Select id="eo-add-product" placeholder={productOptions ? "Select product" : "Loading products…"} value={newProductId} onChange={(e) => setNewProductId(e.target.value)} options={(productOptions || []).map((p) => ({ value: String(p.id), label: p.sku ? `${p.title} (${p.sku})` : p.title }))} />
                  </Field>
                  <Field label="Qty" htmlFor="eo-add-qty"><Input id="eo-add-qty" type="number" min="1" step="1" className="num" value={newProductQty} onChange={(e) => setNewProductQty(e.target.value)} /></Field>
                  <Field label="Unit price (BDT)" htmlFor="eo-add-price"><Input id="eo-add-price" type="number" min="0" step="1" className="num" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} /></Field>
                  <Button type="button" variant="outline" icon={FiPlus} onClick={addProduct}>Add</Button>
                </div>
                {!productOptions && <p className="muted" style={{ margin: 0 }}>Product list unavailable right now — existing items can still be edited.</p>}
              </div>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Order status" />
            <div className="stack" style={{ padding: "0 1.25rem 1.25rem" }}>
              <Field label="Status" htmlFor="eo-status"><Select id="eo-status" options={ORDER_STATUS_OPTIONS} value={form.status} onChange={set("status")} /></Field>
              <Field label="Payment status" htmlFor="eo-payment"><Select id="eo-payment" options={PAYMENT_STATUS_OPTIONS} value={form.paymentStatus} onChange={set("paymentStatus")} /></Field>
              <Field label="Payment method" htmlFor="eo-method">
                <Select id="eo-method" options={PAYMENT_METHODS.some((m) => m.value === form.paymentMethod) ? PAYMENT_METHODS : [...PAYMENT_METHODS, { value: form.paymentMethod, label: form.paymentMethod }]} value={form.paymentMethod} onChange={set("paymentMethod")} />
              </Field>
              <Field label="Courier Entry" htmlFor="eo-courier"><Select id="eo-courier" options={courierOptionsWith(form.courier)} value={form.courier} onChange={set("courier")} /></Field>
              <p className="muted" style={{ margin: 0 }}>Current status: {orderStatusMeta(order.status).label}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Charges & totals" subtitle="Recalculated from the items on the left." />
            <div className="stack" style={{ padding: "0 1.25rem 1.25rem" }}>
              <Field label="Shipping cost (BDT)" htmlFor="eo-shipping"><Input id="eo-shipping" type="number" min="0" step="1" className="num" value={form.shippingCost} onChange={set("shippingCost")} /></Field>
              <Field label="Advance payment (BDT)" htmlFor="eo-advance"><Input id="eo-advance" type="number" min="0" step="1" className="num" value={form.advancePayment} onChange={set("advancePayment")} /></Field>
              <dl className="summary-dl" style={{ display: "grid", gap: 8, margin: 0 }}>
                <div className="summary-row"><dt>Items subtotal</dt><dd className="num">{formatMoney(totals.itemsTotal)}</dd></div>
                <div className="summary-row"><dt>Shipping</dt><dd className="num">{formatMoney(totals.shipping)}</dd></div>
                <div className="summary-row"><dt>Advance</dt><dd className="num">-{formatMoney(totals.advance)}</dd></div>
                <div className="summary-row"><dt>Total</dt><dd className="num"><strong>{formatMoney(totals.total)}</strong></dd></div>
                <div className="summary-row summary-total"><dt>Total due</dt><dd className="num"><strong>{formatMoney(totals.due)}</strong></dd></div>
              </dl>
              {Math.abs(getInvoiceData(order).adjustment) >= 0.005 && (
                <p className="muted" style={{ margin: 0 }}>This order currently has a discount/adjustment of {formatMoney(getInvoiceData(order).adjustment)} vs its item lines. Saving here recalculates the total from items + shipping.</p>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(null)}>Reset</Button>
                <Button type="submit" variant="primary" icon={FiSave} loading={saving} disabled={!dirty}>Save changes</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
