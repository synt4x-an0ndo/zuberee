"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, formatTk, imgUrl } from "@/lib/api";
import { normalizeOrder } from "@/lib/order";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Printable invoice (/dashboard/orders/invoice/{orderId})
 *  - GET api/orders/{orderId}
 *  - GET api/footer-settings/1   (shop contact block shown on the invoice)
 */
function Invoice({ id }) {
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [footer, setFooter] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [o, f] = await Promise.all([
          api.get(`api/orders/${id}`),
          api.get("api/footer-settings/1", { auth: false }).catch(() => null),
        ]);
        if (!alive) return;
        setOrder(normalizeOrder(o?.data?.data || o?.data || o));
        setFooter(f?.data || f);
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (missing)
    return <div className="text-center py-5 text-muted">Order not found</div>;
  if (!order) return <Loader />;

  const items = order.items || order.order_items || order.cart_items || [];
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.totalPrice ?? it.total ?? 0) || 0),
    0
  );
  const shipping = Number(order.shipping_cost) || 0;
  const advance = Number(order.advance_payment) || 0;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3 no-print">
        <Link href="/admin/orders" className="btn btn-sm btn-outline-secondary">
          ← Back to Orders
        </Link>
        <button className="btn btn-grad" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <div ref={printRef} className="card border-0 shadow-sm mx-auto" style={{ maxWidth: 860 }}>
        <div className="card-body p-5">
          <div className="d-flex justify-content-between mb-4">
            <div>
              <h3 className="fw-bold mb-0">INVOICE</h3>
              <div className="text-muted small">
                {footer?.shop_name || ""}
              </div>
              {footer?.address && <div className="small">{footer.address}</div>}
              {footer?.phone && <div className="small">Phone: {footer.phone}</div>}
              {footer?.email && <div className="small">Email: {footer.email}</div>}
            </div>
            <div className="text-end">
              <div>
                <b>Invoice No:</b> #{order.id}
              </div>
              <div>
                <b>Date:</b>{" "}
                {order.created_at
                  ? new Date(order.created_at).toLocaleDateString("en-GB", {
                      timeZone: "Asia/Dhaka",
                    })
                  : "—"}
              </div>
              <div>
                <b>Payment Method:</b> {order.payment_method}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <b>Bill To:</b>
            <div>{order.name}</div>
            <div>{order.phone}</div>
            <div>
              {order.address}, {order.district}
            </div>
          </div>

          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Product Description</th>
                <th>Variant</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.title}</td>
                  <td>
                    {[it.color_name || it.color, it.size].filter(Boolean).join(" / ") ||
                      "—"}
                  </td>
                  <td>{it.qty}</td>
                  <td>{formatTk(it.unitPrice ?? it.price)}৳</td>
                  <td>{formatTk(it.totalPrice ?? it.total)}৳</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row">
            <div className="col-md-6">
              {order.delivery_notes && (
                <>
                  <b>Notes:</b>
                  <div className="small">{order.delivery_notes}</div>
                </>
              )}
            </div>
            <div className="col-md-6">
              <div className="d-flex justify-content-between">
                <span>Subtotal:</span>
                <b>{formatTk(subtotal)}৳</b>
              </div>
              <div className="d-flex justify-content-between">
                <span>Shipping Cost:</span>
                <b>{formatTk(shipping)}৳</b>
              </div>
              <div className="d-flex justify-content-between">
                <span>Advance Payment:</span>
                <b>{formatTk(advance)}৳</b>
              </div>
              <hr />
              <div className="d-flex justify-content-between fs-5 fw-bold">
                <span>Total Due:</span>
                <span>{formatTk(subtotal + shipping - advance)}৳</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage({ params }) {
  const { orderId } = use(params);
  return (
    <PageGate permission="view orders">
      <Invoice id={orderId} />
    </PageGate>
  );
}
