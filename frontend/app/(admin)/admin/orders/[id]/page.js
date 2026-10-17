"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FiArrowLeft, FiPhone, FiMapPin, FiTruck, FiImage, FiEdit2, FiPrinter, FiDownload, FiSave } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import Img from "@/components/Img";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Select, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, formatMoney, imgUrl, request } from "@/lib/api";
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, formatDateTime, formatOrderNumber, orderStatusMeta, paymentStatusMeta } from "@/lib/format";
import { courierLabel, courierOptionsWith } from "@/lib/couriers";
import { getInvoiceData } from "@/lib/orderInvoice";
import { downloadOrderInvoicePdf } from "@/lib/orderInvoicePdf";
import { useAsync } from "@/lib/useAsync";

/**
 * Order detail — Zuberee-style three columns:
 * Ordered Products | Order Summary | Manage Order (status / payment / courier,
 * Edit, Invoice). Status + payment save through the existing PATCH endpoint
 * today; `courier_entry` rides along in the same payload for the extended
 * order-update API (see frontend/ORDER_API_FRONTEND_CONTRACT.md).
 */
export default function AdminOrderDetail() {
  const { id } = useParams();
  const { toast, confirm } = useFeedback();
  const { siteName, primaryColor, company } = useSite();
  const { data: order, loading, error, reload } = useAsync(() => api.get(`api/admin/orders/${id}`).then((b) => b.data), [id]);
  const [status, setStatus] = useState(null);
  const [payment, setPayment] = useState(null);
  const [courier, setCourier] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");

  if (loading) {
    return <div className="stack"><Skeleton style={{ height: 40, width: 260 }} /><Skeleton style={{ height: 380 }} /></div>;
  }
  if (error || !order) {
    return <ErrorState message={error || "Order not found."} onRetry={reload} />;
  }

  const inv = getInvoiceData(order);
  const currentStatus = status ?? String(order.status || "pending").toLowerCase();
  const currentPayment = payment ?? String(order.payment_status || "pending").toLowerCase();
  const currentCourier = courier ?? inv.courier ?? "";
  const statusChanged = status !== null && status !== String(order.status || "").toLowerCase();
  const paymentChanged = payment !== null && payment !== String(order.payment_status || "").toLowerCase();
  const courierChanged = courier !== null && courier !== (inv.courier ?? "");
  const dirty = statusChanged || paymentChanged || courierChanged;
  const st = orderStatusMeta(order.status);
  const pay = paymentStatusMeta(order.payment_status);

  const save = async () => {
    if (statusChanged && currentStatus === "cancelled") {
      const ok = await confirm({ title: "Cancel this order?", message: "The customer will see it as cancelled.", confirmText: "Cancel order", danger: true });
      if (!ok) return;
    }
    const body = {};
    if (statusChanged) body.status = currentStatus.toUpperCase();
    if (paymentChanged) body.paymentStatus = currentPayment.toUpperCase();
    if (courierChanged) body.courier_entry = currentCourier;
    setSaving(true);
    setNotice("");
    try {
      const res = await request(`api/admin/orders/${id}`, { method: "PATCH", body });
      const savedCourier = typeof res?.data?.courier_entry === "string" ? res.data.courier_entry : null;
      setStatus(null);
      setPayment(null);
      setCourier(null);
      if (courierChanged && savedCourier !== currentCourier) {
        // Today's API ignores courier_entry — be honest rather than pretend it saved.
        setNotice("Order status/payment saved. Courier assignment is ready in the UI but the current order API does not store courier_entry yet (see ORDER_API_FRONTEND_CONTRACT.md).");
        toast.info("Saved — courier assignment still needs the extended order API.");
      } else {
        toast.success("Order updated.");
      }
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const filename = await downloadOrderInvoicePdf({ order, siteName: siteName || "Store", primaryColor, company });
      toast.success(`Invoice downloaded (${filename}).`);
    } catch (err) {
      console.error("Invoice PDF failed:", err);
      toast.error("The invoice PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <Link href="/admin/orders" className="link-arrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FiArrowLeft aria-hidden="true" /> Back to orders
      </Link>

      <AdminHeader
        eyebrow={`Placed ${formatDateTime(order.created_at)}${order.customer_type ? ` · ${order.customer_type}` : ""}`}
        title={formatOrderNumber(order)}
        subtitle={order.updated_at ? `Last updated ${formatDateTime(order.updated_at)} · Order #${order.id}` : `Order #${order.id}`}
        actions={(
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone={st.tone}>{st.label}</Badge>
            {order.payment_status && <Badge tone={pay.tone}>{pay.label}</Badge>}
            <Button as={Link} href={`/admin/orders/edit/${order.id}`} variant="outline" icon={FiEdit2}>Edit</Button>
            <Button as={Link} href={`/admin/orders/invoice/${order.id}`} variant="outline" icon={FiPrinter}>Invoice</Button>
            <Button type="button" variant="primary" icon={FiDownload} loading={downloading} onClick={downloadPdf}>PDF</Button>
          </div>
        )}
      />

      {notice && <p className="notice notice-info" role="status" style={{ margin: 0 }}>{notice}</p>}

      <div className="grid-3" style={{ alignItems: "start" }}>
        {/* ---------------- Ordered products ---------------- */}
        <Card>
          <CardHeader title="Ordered products" subtitle={`${inv.items.length} product${inv.items.length === 1 ? "" : "s"} · ${inv.items.reduce((sum, item) => sum + item.qty, 0)} units`} />
          {inv.items.length === 0 ? (
            <p className="muted" style={{ padding: "0 1.25rem 1.25rem" }}>No items on this order.</p>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: "0 1.25rem 1.25rem", display: "grid", gap: 10 }}>
              {inv.items.map((item, index) => {
                const source = (order.order_items || order.items || [])[index];
                const image = imgUrl(source?.colorImage ?? source?.image ?? source?.image_url);
                return (
                  <li key={item.key} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div className={image ? "order-item-thumb" : "order-item-thumb order-item-thumb-empty"} style={{ flexShrink: 0 }}>
                        {image ? <Img src={image} alt="" width={48} height={56} sizes="48px" /> : <FiImage aria-hidden="true" />}
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                        <span className="muted">{index + 1}. </span>{item.title}
                        {item.sku && <span className="muted num" style={{ display: "block", fontSize: "0.8rem", fontWeight: 500 }}>{item.sku}</span>}
                      </p>
                    </div>
                    <p className="num" style={{ margin: 0 }}>Qty: {item.qty} × {formatMoney(item.unitPrice)} = <strong>{formatMoney(item.total)}</strong></p>
                    {(item.size || item.variant) && <p className="muted" style={{ margin: 0 }}>Size: {item.size || item.variant}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* ---------------- Order summary ---------------- */}
        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Order summary" />
            <dl className="summary-dl" style={{ padding: "0 1.25rem 1.25rem", display: "grid", gap: 10 }}>
              <div className="summary-row"><dt>Payment Method</dt><dd style={{ textTransform: "capitalize" }}>{inv.paymentMethod || "cash"}</dd></div>
              <div className="summary-row"><dt>Payment Status</dt><dd><Badge tone={pay.tone}>{pay.label}</Badge></dd></div>
              <div className="summary-row"><dt>Subtotal</dt><dd className="num">{formatMoney(inv.subtotal)}</dd></div>
              <div className="summary-row"><dt>Shipping Cost</dt><dd className="num">৳{Math.round(inv.shipping)}</dd></div>
              <div className="summary-row"><dt>Advance Payment</dt><dd className="num">৳{Math.round(inv.advance)}</dd></div>
              <div className="summary-row"><dt>Total</dt><dd className="num"><strong>৳{Math.round(inv.total)}</strong></dd></div>
              <div className="summary-row summary-total"><dt>Total Due</dt><dd className="num"><strong>৳{Math.round(inv.totalDue)}</strong></dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Customer & delivery" />
            <ul className="detail-list" style={{ listStyle: "none", padding: "0 1.25rem 1.25rem", margin: 0, display: "grid", gap: 12 }}>
              <li><strong>{inv.customer.name || "Guest"}</strong>{inv.customer.type && <span className="muted" style={{ marginLeft: 8, fontSize: "0.85rem" }}>{inv.customer.type}</span>}</li>
              {inv.customer.phone && <li><a href={`tel:${inv.customer.phone}`} className="num"><FiPhone aria-hidden="true" /> {inv.customer.phone}</a></li>}
              <li style={{ color: "var(--ink-2)" }}><FiMapPin aria-hidden="true" /> {inv.customer.address}{inv.customer.district ? ` (${inv.customer.district})` : ""}</li>
              {inv.courier && <li style={{ color: "var(--ink-2)" }}><FiTruck aria-hidden="true" /> Courier: {courierLabel(inv.courier)}</li>}
              {inv.deliveryNotes && <li style={{ color: "var(--ink-2)" }}>Note: {inv.deliveryNotes}</li>}
            </ul>
          </Card>
        </div>

        {/* ---------------- Manage order ---------------- */}
        <Card>
          <CardHeader title="Manage order" subtitle="Update fulfilment, then save." />
          <div className="stack" style={{ padding: "0 1.25rem 1.25rem" }}>
            <Field label="Status" htmlFor="o-status">
              <Select id="o-status" options={ORDER_STATUS_OPTIONS} value={currentStatus} onChange={(e) => setStatus(e.target.value)} />
            </Field>
            <Field label="Payment status" htmlFor="o-pay">
              <Select id="o-pay" options={PAYMENT_STATUS_OPTIONS} value={currentPayment} onChange={(e) => setPayment(e.target.value)} />
            </Field>
            <Field label="Courier Entry" htmlFor="o-courier">
              <Select id="o-courier" options={courierOptionsWith(currentCourier)} value={currentCourier} onChange={(e) => setCourier(e.target.value)} />
            </Field>
            <Button type="button" variant="primary" icon={FiSave} disabled={!dirty} loading={saving} onClick={save}>Save changes</Button>
            {dirty && (
              <Button type="button" variant="ghost" disabled={saving} onClick={() => { setStatus(null); setPayment(null); setCourier(null); }}>
                Reset changes
              </Button>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Button as={Link} href={`/admin/orders/edit/${order.id}`} variant="outline" icon={FiEdit2}>Edit</Button>
              <Button as={Link} href={`/admin/orders/invoice/${order.id}`} variant="primary" icon={FiPrinter}>Invoice</Button>
            </div>
            <Button type="button" variant="ghost" icon={FiDownload} loading={downloading} onClick={downloadPdf}>Download invoice PDF</Button>
          </div>
        </Card>
      </div>

      {/* Items table (full width, kept from the previous detail view) */}
      <Card>
        <CardHeader title="Items" subtitle="Line-by-line breakdown used on the invoice." />
        <DataTable>
          <thead>
            <tr><th>Product</th><th>Variant</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {inv.items.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.title}</strong>{item.sku && <span className="muted num" style={{ display: "block", fontSize: "0.82rem" }}>{item.sku}</span>}</td>
                <td className="muted">{item.variant || "—"}</td>
                <td className="text-right num">{item.qty}</td>
                <td className="text-right num">{formatMoney(item.unitPrice)}</td>
                <td className="text-right num">{formatMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
}
