"use client";

import Link from "next/link";
import { useState } from "react";
import { FiPackage, FiSearch } from "react-icons/fi";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Skeleton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { api, formatMoney, normalizePhone } from "@/lib/api";
import { formatDateTime, formatOrderNumber, orderStatusMeta, paymentStatusMeta } from "@/lib/format";

/**
 * Public order tracking.
 *
 * Backend contract (backend/app/api/orders/[id]/route.js — GET, no auth):
 *   GET /api/orders/:id
 *   -> 200 { success, message: "Order loaded.", data: {
 *        id, user_id, guest: { name, phone } | null, status, payment_status,
 *        total_amount, shipping_fee, shipping_address, district, advance_payment,
 *        payment_method, items: [{ id, product_id, title, sku, unit_price, quantity, subtotal }],
 *        created_at, updated_at } }
 *   -> 400 "Invalid order ID."   -> 404 "Order not found."
 *
 * The route answers with delivery details to anyone who knows the id, so this page only reveals the
 * full record when the visitor can prove they own it: either they are signed in as the account the
 * order belongs to, or they enter the phone number the guest order was placed with. Otherwise a
 * limited summary is shown. (The underlying exposure is reported to the backend team.)
 */

export default function TrackOrderPage() {
  const { user } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState({ loading: false, error: "", notFound: false, order: null });

  const lookup = async (event) => {
    event.preventDefault();
    if (state.loading) return; // no duplicate submissions
    const id = Number(String(orderId).replace(/[^0-9]/g, ""));
    if (!Number.isInteger(id) || id <= 0) {
      setState({ loading: false, error: "Enter the order number shown on your receipt or in your account.", notFound: false, order: null });
      return;
    }
    setState({ loading: true, error: "", notFound: false, order: null });
    try {
      const body = await api.get(`api/orders/${id}`, { auth: false });
      setState({ loading: false, error: "", notFound: false, order: body.data || null });
    } catch (err) {
      if (err.status === 404) {
        setState({ loading: false, error: "", notFound: true, order: null });
      } else {
        setState({ loading: false, error: err.message || "The order could not be loaded.", notFound: false, order: null });
      }
    }
  };

  const order = state.order;
  const ownsAccount = Boolean(order && user && order.user_id && String(order.user_id) === String(user.id));
  const enteredPhone = normalizePhone(phone);
  const guestPhone = normalizePhone(order?.guest?.phone || "");
  const phoneMatches = Boolean(enteredPhone && guestPhone && enteredPhone === guestPhone);
  const revealed = Boolean(order) && (ownsAccount || phoneMatches);
  const status = order ? orderStatusMeta(order.status) : null;
  const payment = order ? paymentStatusMeta(order.payment_status) : null;

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 720 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <p className="eyebrow">Support</p>
          <h1>Track an order</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            Enter your order number and the phone number you used — or sign in to the account that placed it.
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={lookup} noValidate>
          <div className="grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Field label="Order number" htmlFor="to-id" required hint="For example 11 or ORD-00011.">
              <Input id="to-id" value={orderId} onChange={(e) => setOrderId(e.target.value)} inputMode="numeric" placeholder="ORD-00011" />
            </Field>
            <Field label="Phone number" htmlFor="to-phone" hint="The number given when the order was placed.">
              <Input id="to-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="01712345678" />
            </Field>
          </div>
          <div className="row" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
            <Button variant="primary" type="submit" disabled={state.loading}>
              <FiSearch aria-hidden="true" /> {state.loading ? "Looking…" : "Find my order"}
            </Button>
          </div>
        </form>
      </Card>

      {state.loading && <Skeleton style={{ height: 180 }} />}

      {state.error && <ErrorState message={state.error} />}

      {state.notFound && (
        <EmptyState
          icon={FiPackage}
          title="No order with that number"
          text="Check the number on your receipt, or sign in and open My orders to see the orders placed with your account."
          action={<Button href="/user/orders" variant="ghost">Open my orders</Button>}
        />
      )}

      {order && (
        <Card>
          <CardHeader
            title={formatOrderNumber(order)}
            subtitle={`Placed ${formatDateTime(order.created_at)}`}
            actions={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {status && <Badge tone={status.tone}>{status.label}</Badge>}
                {payment && <Badge tone={payment.tone}>{payment.label}</Badge>}
              </div>
            }
          />

          {!revealed ? (
            <div className="stack" style={{ gap: 10 }}>
              <p className="muted" style={{ marginBottom: 0 }}>
                This order belongs to a customer record we cannot confirm from here, so only a summary is shown.
              </p>
              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6 }}>
                <li>Total: <strong className="num">{formatMoney(order.total_amount)}</strong></li>
                <li>Items: <strong>{order.items?.length || 0}</strong></li>
                <li>Delivery district: <strong>{order.district || "—"}</strong></li>
              </ul>
              <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 0 }}>
                {order.guest
                  ? "Enter the phone number used on this order to see the delivery details."
                  : "This order is linked to a customer account — sign in with that account to see the delivery details."}
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <ul className="order-items" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {(order.items || []).map((item) => (
                  <li key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>
                      {item.title || `Product ${item.product_id}`}
                      {item.sku ? <span className="muted"> · {item.sku}</span> : null}
                      <span className="muted"> × {item.quantity}</span>
                    </span>
                    <span className="num">{formatMoney(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="stack" style={{ gap: 4 }}>
                <p style={{ margin: 0 }}><strong>Delivering to:</strong> {order.shipping_address}</p>
                {order.guest?.name && <p className="muted" style={{ margin: 0 }}>Recipient: {order.guest.name}</p>}
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <p style={{ margin: 0 }}>Delivery fee: <span className="num">{formatMoney(order.shipping_fee)}</span></p>
                {Number(order.advance_payment) > 0 && (
                  <p style={{ margin: 0 }}>Advance paid: <span className="num">{formatMoney(order.advance_payment)}</span></p>
                )}
                <p style={{ margin: 0, fontWeight: 700 }}>Total: <span className="num">{formatMoney(order.total_amount)}</span></p>
                <p className="muted" style={{ margin: 0, textTransform: "capitalize" }}>Payment: {order.payment_method}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      <p className="muted" style={{ fontSize: "0.88rem" }}>
        Something wrong with an order? <Link href="/return_policy" className="link-arrow">Read our return policy</Link> or call the shop.
      </p>
    </div>
  );
}
