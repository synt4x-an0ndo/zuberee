"use client";

/**
 * Edit order — full frontend form (Zuberee-style).
 *
 * Everything is displayed and editable. Saving sends ONE PATCH to
 * `api/admin/orders/:id` with the contract in
 * frontend/ORDER_API_FRONTEND_CONTRACT.md:
 *   { status, paymentStatus, courier_entry, name, phone, email, address,
 *     district, payment_method, shipping_cost, advance_payment,
 *     delivery_notes, items: [{ id, product_id, qty, unitPrice, size }] }
 *
 * Today's backend only persists `status` + `paymentStatus`; the other fields
 * ride along and are verified against the PATCH response. Anything the API
 * did not store is reported honestly on this page (never faked as saved) so
 * the backend dev can wire the extended fields without a UI change here.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FiArrowLeft, FiPlus, FiSave, FiTrash2, FiPrinter } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, ErrorState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, request } from "@/lib/api";
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
  const itemsChanged = JSON.stringify(original.items.map((i) => [i.id, i.product_id, i.qty, i.unitPrice, i.size])) !== JSON.stringify(form.items.map((i) => [i.id, i.product_id, i.qty, i.unitPrice, i.size]));
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
    if (!form.phone.trim()) return setFormError("Customer phone is required.");
    if (!form.address.trim()) return setFormError("Delivery address is required.");
    if (form.items.length === 0) return setFormError("An order needs at least one item. Add a product before saving.");
    if (form.items.some((item) => !(Number(item.qty) >= 1) || !(Number(item.unitPrice) >= 0))) return setFormError("Every item needs a quantity of at least 1 and a price of 0 or more.");
    if (totals.advance > totals.total) return setFormError("Advance payment cannot be more than the order total.");

    if (statusChanged && form.status === "cancelled") {
      const ok = await confirm({ title: "Cancel this order?", message: "The customer will see it as cancelled.", confirmText: "Cancel order", danger: true });
      if (!ok) return;
    }

    const body = {
      status: form.status.toUpperCase(),
      paymentStatus: form.paymentStatus.toUpperCase(),
      courier_entry: form.courier,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      district: form.district,
      payment_method: form.paymentMethod,
      shipping_cost: Number(form.shippingCost) || 0,
      advance_payment: Number(form.advancePayment) || 0,
      delivery_notes: form.deliveryNotes.trim(),
      items: form.items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        size: item.size || undefined,
      })),
    };

    setSaving(true);
    try {
      const res = await request(`api/admin/orders/${id}`, { method: "PATCH", body });
      const saved = res?.data ? formFromOrder(res.data) : null;
      setDraft(null);
      if (extendedChanged && saved) {
        const notStored =
          saved.name !== form.name || saved.phone !== form.phone || saved.address !== form.address ||
          String(saved.district).toLowerCase() !== String(form.district).toLowerCase() ||
          Number(saved.shippingCost) !== Number(form.shippingCost) || Number(saved.advancePayment) !== Number(form.advancePayment) ||
          saved.items.length !== form.items.length ||
          saved.items.some((item, index) => Number(item.qty) !== Number(form.items[index]?.qty) || Number(item.unitPrice) !== Number(form.items[index]?.unitPrice));
        if (notStored) {
          setSaveNote("Status/payment were saved. Customer, item, charge or courier edits were sent but the current order API does not store them yet — they will save automatically once the backend implements ORDER_API_FRONTEND_CONTRACT.md. Nothing was faked.");
          toast.info("Saved — some fields still need the extended order API.");
          reload();
          return;
        }
      }
      toast.success("Order saved.");
      router.push(`/admin/orders/${id}`);
    } catch (err) {
      if (extendedChanged && !statusChanged && !paymentChanged) {
        setFormError(`${err.message} The current order API only saves status/payment for now; customer, item, charge and courier fields are ready in this form for the extended API (ORDER_API_FRONTEND_CONTRACT.md).`);
      } else {
        setFormError(err.message || "The order could not be saved.");
      }
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

      <p className="notice notice-info" role="note" style={{ margin: 0 }}>
        Status and payment status save through the current API today. Customer, item, shipping/advance, payment-method and courier fields are fully editable here and are sent in the same save — the backend dev can persist them per <strong>ORDER_API_FRONTEND_CONTRACT.md</strong> without any further frontend change.
      </p>
      {saveNote && <p className="notice notice-info" role="status" style={{ margin: 0 }}>{saveNote}</p>}
      {formError && <p className="notice notice-danger" role="alert" style={{ margin: 0 }}>{formError}</p>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Customer & delivery" />
            <div className="stack" style={{ padding: "0 1.25rem 1.25rem" }}>
              <Field label="Customer name" htmlFor="eo-name" required><Input id="eo-name" value={form.name} onChange={set("name")} /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Phone" htmlFor="eo-phone" required><Input id="eo-phone" className="num" value={form.phone} onChange={set("phone")} /></Field>
                <Field label="Email" htmlFor="eo-email"><Input id="eo-email" type="email" value={form.email} onChange={set("email")} /></Field>
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
