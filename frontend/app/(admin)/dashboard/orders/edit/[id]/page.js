"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, formatTk } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";
import { ORDER_STATUSES } from "@/lib/orderStatuses";
import { normalizeOrder } from "@/lib/order";

/**
 * Edit order (/dashboard/orders/edit/{id})
 *  - GET  api/orders/{id}
 *  - GET  api/order-product-options      (product picker)
 *  - PATCH api/orders/{id}  { status, paymentStatus }
 */
function EditOrder({ id }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [options, setOptions] = useState({}); // product_id -> {sizes, colors}
  const [items, setItems] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    district: "",
    address: "",
    delivery_notes: "",
    payment_method: "cash",
    shipping_cost: 0,
    advance_payment: 0,
    status: "Pending",
    payment_status: "PENDING",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [o, p] = await Promise.all([
          api.get(`api/orders/${id}`),
          api.get("api/order-product-options").catch(() => ({ data: [] })),
        ]);
        if (!alive) return;
        const ord = normalizeOrder(o?.data?.data || o?.data || o);
        setOrder(ord);
        setForm({
          name: ord.name || "",
          phone: ord.phone || "",
          email: ord.email || "",
          district: ord.district || "",
          address: ord.address || "",
          delivery_notes: ord.delivery_notes || "",
          payment_method: ord.payment_method || "cash",
          shipping_cost: ord.shipping_cost ?? 0,
          advance_payment: ord.advance_payment ?? 0,
          status: String(ord.status || "PENDING").toUpperCase().replace(/-/g, "_"),
          payment_status: String(ord.payment_status || ord.paymentStatus || "PENDING").toUpperCase(),
        });
        setItems(
          (ord.items || ord.order_items || ord.cart_items || []).map((it) => ({
            id: it.id,
            product_id: it.product_id,
            title: it.title,
            size_id: it.size_id ?? "",
            color: it.color ?? "",
            unitPrice: Number(it.unitPrice ?? it.price ?? 0),
            qty: Number(it.qty ?? 1),
            totalPrice: Number(it.totalPrice ?? it.total ?? 0),
          }))
        );
        const list = p?.data?.data || p?.data || (Array.isArray(p) ? p : []);
        setProducts(Array.isArray(list) ? list : []);
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* lazy-load sizes/colors for a chosen product */
  const ensureOptions = async (productId) => {
    if (!productId || options[productId]) return;
    try {
      const r = await api.get(`api/products/${productId}`);
      const p = r?.data || {};
      setOptions((o) => ({
        ...o,
        [productId]: { sizes: p.sizes || [], colors: p.colors || [] },
      }));
    } catch {}
  };

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setItem = (i, k, v) =>
    setItems((list) => {
      const next = [...list];
      next[i] = { ...next[i], [k]: v };
      if (k === "qty" || k === "unitPrice") {
        next[i].totalPrice = Number(next[i].qty) * Number(next[i].unitPrice);
      }
      return next;
    });

  const removeItem = (i) =>
    setItems((list) => {
      const it = list[i];
      if (it.id) setDeleted((d) => [...d, it.id]);
      return list.filter((_, j) => j !== i);
    });

  const subtotal = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
  const total = subtotal + Number(form.shipping_cost || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (items.length) {
      const bad = items.find(
        (it) =>
          !it.product_id ||
          !it.title ||
          !Number(it.qty) ||
          Number(it.qty) < 1 ||
          Number.isNaN(Number(it.unitPrice))
      );
      if (bad) {
        notify.error("Please complete all product rows before updating");
        return;
      }
    }
    setSaving(true);
    try {
      await api.patch(`api/orders/${id}`, {
        status: form.status,
        paymentStatus: form.payment_status,
      });
      notify.success("Order updated successfully!");
      router.push("/dashboard/orders");
    } catch (err) {
      notify.error(err.message || "Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  if (missing) return <div className="text-center py-5 text-muted">Order not found</div>;
  if (!order) return <Loader />;

  return (
    <div className="container-fluid py-4">
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold">Edit Order #{id}</h5>
          <Link href="/dashboard/orders" className="btn btn-sm btn-outline-secondary">
            ← Back
          </Link>
        </div>
        <div className="card-body">
          <form onSubmit={submit}>
            <div className="row mb-4">
              <div className="col-md-6">
                <h6 className="fw-bold">Customer Information</h6>
                <div className="mb-2">
                  <label className="form-label">Name *</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setF("name", e.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Phone *</label>
                  <input
                    className="form-control"
                    value={form.phone}
                    onChange={(e) => setF("phone", e.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    value={form.email}
                    onChange={(e) => setF("email", e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-2">
                  <label className="form-label">District *</label>
                  <input
                    className="form-control"
                    value={form.district}
                    onChange={(e) => setF("district", e.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Address *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setF("address", e.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Delivery Notes</label>
                  <input
                    className="form-control"
                    value={form.delivery_notes}
                    onChange={(e) => setF("delivery_notes", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <h6 className="fw-bold">Order Items</h6>
            <div className="table-responsive mb-2">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Product *</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th style={{ width: 100 }}>Qty *</th>
                    <th style={{ width: 130 }}>Price *</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const opts = options[it.product_id];
                    return (
                      <tr key={i}>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={it.product_id || ""}
                            onChange={(e) => {
                              const prod = products.find(
                                (p) => String(p.id) === e.target.value
                              );
                              setItem(i, "product_id", e.target.value);
                              setItem(i, "title", prod?.title || it.title);
                              if (prod) {
                                setItem(i, "unitPrice", Number(prod.price) || 0);
                                setItem(
                                  i,
                                  "totalPrice",
                                  Number(prod.price || 0) * Number(it.qty || 1)
                                );
                                setItem(i, "size_id", "");
                                setItem(i, "color", "");
                                ensureOptions(prod.id);
                              }
                            }}
                          >
                            <option value="">Select product first</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title}
                                {p.sku ? ` (${p.sku})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={it.size_id || ""}
                            onChange={(e) => setItem(i, "size_id", e.target.value)}
                            onFocus={() => ensureOptions(it.product_id)}
                          >
                            <option value="">
                              {!it.product_id
                                ? "Select product first"
                                : opts?.sizes?.length
                                ? "Select Size"
                                : "No sizes available"}
                            </option>
                            {(opts?.sizes || []).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.size}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={it.color || ""}
                            onChange={(e) => setItem(i, "color", e.target.value)}
                            onFocus={() => ensureOptions(it.product_id)}
                          >
                            <option value="">
                              {!it.product_id
                                ? "Select product first"
                                : opts?.colors?.length
                                ? "Select Color"
                                : "No colors available"}
                            </option>
                            {(opts?.colors || []).map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className="form-control form-control-sm"
                            value={it.qty}
                            onChange={(e) => setItem(i, "qty", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={it.unitPrice}
                            onChange={(e) => setItem(i, "unitPrice", e.target.value)}
                          />
                        </td>
                        <td className="fw-semibold">{formatTk(it.totalPrice)}৳</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeItem(i)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary mb-4"
              onClick={() =>
                setItems((l) => [
                  ...l,
                  {
                    product_id: "",
                    title: "",
                    size_id: "",
                    color: "",
                    unitPrice: 0,
                    qty: 1,
                    totalPrice: 0,
                  },
                ])
              }
            >
              + Add Product
            </button>

            <div className="row">
              <div className="col-md-7">
                <div className="row g-2">
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Payment Method *</label>
                    <select
                      className="form-select"
                      value={form.payment_method}
                      onChange={(e) => setF("payment_method", e.target.value)}
                    >
                      <option value="cash">Cash on Delivery</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Status *</label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={(e) => setF("status", e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Payment Status *</label>
                    <select
                      className="form-select"
                      value={form.payment_status}
                      onChange={(e) => setF("payment_status", e.target.value)}
                    >
                      {['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Shipping Cost *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.shipping_cost}
                      onChange={(e) => setF("shipping_cost", e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Advance Payment</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.advance_payment}
                      onChange={(e) => setF("advance_payment", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="col-md-5">
                <div className="card bg-light border">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <span>Subtotal:</span>
                      <b>{formatTk(subtotal)}৳</b>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Shipping:</span>
                      <b>{formatTk(form.shipping_cost)}৳</b>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Advance Payment:</span>
                      <b>{formatTk(form.advance_payment)}৳</b>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between">
                      <span>Total:</span>
                      <b>{formatTk(total)}৳</b>
                    </div>
                    <div className="d-flex justify-content-between text-danger">
                      <span>Due:</span>
                      <b>{formatTk(total - Number(form.advance_payment || 0))}৳</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                {saving ? "Saving..." : "Update Order"}
              </button>
              <Link href="/dashboard/orders" className="btn btn-outline-secondary px-4">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function OrderEditPage({ params }) {
  const { id } = use(params);
  return (
    <PageGate permission="view orders">
      <EditOrder id={id} />
    </PageGate>
  );
}
