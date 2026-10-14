"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FiArrowLeft, FiPhone, FiMapPin, FiTruck, FiImage } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import Img from "@/components/Img";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Select, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, imgUrl, request } from "@/lib/api";
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, formatDateTime, formatOrderNumber, orderStatusMeta, paymentStatusMeta } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { toast, confirm } = useFeedback();
  const { data: order, loading, error, reload, setData } = useAsync(() => api.get(`api/admin/orders/${id}`).then((b) => b.data), [id]);
  const [status, setStatus] = useState(null);
  const [payment, setPayment] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <div className="stack"><Skeleton style={{ height: 40, width: 260 }} /><Skeleton style={{ height: 380 }} /></div>;
  }
  if (error || !order) {
    return <ErrorState message={error || "Order not found."} onRetry={reload} />;
  }

  const currentStatus = status ?? String(order.status || "pending").toLowerCase();
  const currentPayment = payment ?? String(order.payment_status || "pending").toLowerCase();
  const dirty = (status !== null && status !== String(order.status).toLowerCase()) || (payment !== null && payment !== String(order.payment_status).toLowerCase());
  const st = orderStatusMeta(order.status);
  const pay = paymentStatusMeta(order.payment_status);
  const hasPayment = Boolean(order.payment_status);

  const save = async () => {
    const body = {};
    if (status !== null && status !== String(order.status).toLowerCase()) body.status = status.toUpperCase();
    if (payment !== null && payment !== String(order.payment_status).toLowerCase()) body.paymentStatus = payment.toUpperCase();
    if (body.status === "CANCELLED") {
      const ok = await confirm({ title: "Cancel this order?", message: "The customer will see it as cancelled.", confirmText: "Cancel order", danger: true });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await request(`api/admin/orders/${id}`, { method: "PATCH", body });
      setStatus(null);
      setPayment(null);
      toast.success("Order updated.");
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const items = order.order_items || order.items || [];
  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <Link href="/admin/orders" className="link-arrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FiArrowLeft aria-hidden="true" /> Back to orders
      </Link>
      <AdminHeader
        eyebrow={`Placed ${formatDateTime(order.created_at)}`}
        title={formatOrderNumber(order)}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge tone={st.tone}>{st.label}</Badge>
            {hasPayment && <Badge tone={pay.tone}>{pay.label}</Badge>}
          </div>
        }
      />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Items" />
            <DataTable>
              <thead>
                <tr><th>Product</th><th>Variant</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const image = imgUrl(it.colorImage ?? it.image ?? it.image_url);
                  return (
                    <tr key={it.id}>
                      <td>
                        <div className="order-item-product order-admin-item">
                          <div className={image ? "order-item-thumb" : "order-item-thumb order-item-thumb-empty"}>
                            {image ? <Img src={image} alt="" width={48} height={56} sizes="48px" /> : <FiImage aria-hidden="true" />}
                          </div>
                          <div className="order-admin-item-copy">
                            <strong>{it.title || "Product"}</strong>
                            {it.sku && <span className="muted num" style={{ display: "block", fontSize: "0.82rem" }}>{it.sku}</span>}
                          </div>
                        </div>
                      </td>
                    <td className="muted">{[it.color_name, it.size || it.selected_size].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="text-right num">{it.qty ?? it.quantity}</td>
                    <td className="text-right num">{formatMoney(it.unitPrice ?? it.unit_price)}</td>
                    <td className="text-right num">{formatMoney(it.totalPrice ?? it.subtotal ?? Number(it.unitPrice ?? 0) * Number(it.qty ?? 0))}</td>
                  </tr>
                  );
                })}
              </tbody>
            </DataTable>
            <dl className="summary-dl" style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 340, marginLeft: "auto" }}>
              <div className="summary-row"><dt>Subtotal</dt><dd className="num">{formatMoney(order.subtotal)}</dd></div>
              <div className="summary-row"><dt>Delivery</dt><dd className="num">{formatMoney(order.shipping_cost)}</dd></div>
              <div className="summary-row"><dt>Advance paid</dt><dd className="num">{formatMoney(order.advance_payment)}</dd></div>
              <div className="summary-row summary-total"><dt>Total</dt><dd className="num">{formatMoney(order.total)}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Update order" subtitle="Set the new status, then save to apply it to the order." />
            <div className="stack">
              <Field label="Order status" htmlFor="o-status">
                <Select id="o-status" options={ORDER_STATUS_OPTIONS} value={currentStatus} onChange={(e) => setStatus(e.target.value)} />
              </Field>
              <Field label="Payment status" htmlFor="o-pay">
                <Select id="o-pay" options={PAYMENT_STATUS_OPTIONS} value={currentPayment} onChange={(e) => setPayment(e.target.value)} />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="ghost" disabled={!dirty || saving} onClick={() => { setStatus(null); setPayment(null); }}>Reset</Button>
                <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>Save changes</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer & delivery" />
            <ul className="detail-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              <li><strong>{order.name || "Guest"}</strong>{order.customer_type && <span className="muted" style={{ marginLeft: 8, fontSize: "0.85rem" }}>{order.customer_type}</span>}</li>
              <li>{order.phone && <a href={`tel:${order.phone}`} className="num"><FiPhone aria-hidden="true" /> {order.phone}</a>}</li>
              <li style={{ color: "var(--ink-2)" }}><FiMapPin aria-hidden="true" /> {order.address}{order.district ? ` (${order.district})` : ""}</li>
              <li style={{ color: "var(--ink-2)" }}><FiTruck aria-hidden="true" /> Payment: {order.payment_method || "cash"}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
