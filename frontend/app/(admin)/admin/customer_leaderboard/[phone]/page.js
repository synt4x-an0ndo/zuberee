"use client";

/**
 * Customer details by phone (Eyara parity).
 *
 * Eyara reference: GET /dashboard/customer_leaderboard/:phone — a customer
 * detail page reached from the leaderboard: name + New/Repeat badge, Total
 * Spent, Contact Information (Phone / Email / District / Address), Order
 * Statistics (Total Orders / First Order / Last Order) and an Order History
 * accordion where each order expands to Payment Method, Shipping Cost,
 * Subtotal, Total, Notes, Courier Entry and its Ordered Items (Qty / Size).
 * Zuberee's leaderboard shows a customer in a modal; it has no standalone
 * detail route. This is that page.
 *
 * FRONTEND ONLY (backend API to be wired by the backend dev, no UI change needed):
 *   GET /api/customers/:phone   (Eyara path; a Zuberee mount such as
 *   GET /api/admin/customer-leaderboard/:phone or /api/admin/customers/:phone
 *   works too — this loader accepts any of these response shapes:)
 *     { data: { name, phone, email, district, address, badge_title|badge,
 *               total_spent, total_orders, first_order_date, last_order_date,
 *               orders: [{ id|order_number, created_at, status, payment_method,
 *                          shipping_cost, subtotal, total, notes, courier_entry,
 *                          items: [{ title, qty, selected_size|size, unitPrice,
 *                                    totalPrice, image }] }] } }
 * Fields are read defensively (several alias keys per field), so the backend
 * dev can return the Eyara shape or extend the existing leaderboard row shape
 * with an `orders` array. Until the endpoint answers, the page renders its
 * full layout with the phone from the URL and empty states.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiChevronDown, FiInfo, FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, Stat, cx } from "@/components/ui";
import { api, formatMoney, imgUrl } from "@/lib/api";
import { badgeLabel, badgeTone } from "@/lib/customers";
import { formatDate, formatDateTime } from "@/lib/format";

const EYARA_BADGE_LABELS = {
  black_list_customer: "Black List Customer",
  very_annoying_customer: "Very Annoying Customer",
  tester: "Tester",
  owner: "Owner",
  silver_customer: "Silver Customer",
  golden_customer: "Golden Customer",
};

const pick = (object, keys) => {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null && object?.[key] !== "") return object[key];
  }
  return undefined;
};

function normaliseDetail(body, phone) {
  const root = body?.data || body || {};
  const customer = root.customer || root.profile || root;
  const orders = Array.isArray(root.orders) ? root.orders : Array.isArray(customer.orders) ? customer.orders : [];

  const totalSpent =
    pick(customer, ["total_spent", "totalSpent"]) ??
    orders.reduce((sum, order) => sum + Number(pick(order, ["total", "grand_total", "total_amount"]) || 0), 0);

  const sortedDates = orders
    .map((order) => pick(order, ["created_at", "date", "ordered_at"]))
    .filter(Boolean)
    .sort();

  return {
    name: pick(customer, ["name", "customer_name"]) || "Customer",
    phone: pick(customer, ["phone", "mobile"]) || phone,
    email: pick(customer, ["email"]),
    district: pick(customer, ["district", "city"]),
    address: pick(customer, ["address", "full_address"]),
    badge: pick(customer, ["badge_title", "assigned_badge", "badge"]),
    totalSpent: Number(totalSpent) || 0,
    totalOrders: Number(pick(customer, ["total_orders", "orders_count"]) ?? orders.length) || 0,
    firstOrder: pick(customer, ["first_order_date", "first_order", "firstOrder"]) || sortedDates[0],
    lastOrder: pick(customer, ["last_order_date", "last_order", "lastOrder", "last_ordered_at"]) || sortedDates[sortedDates.length - 1],
    orders,
  };
}

function orderItems(order) {
  const items = pick(order, ["items", "ordered_items", "order_items", "products", "lines"]);
  return Array.isArray(items) ? items : [];
}

export default function CustomerLeaderboardDetailPage() {
  const params = useParams();
  const phone = decodeURIComponent(String(params?.phone || ""));
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [detail, setDetail] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = await api.get(`api/customers/${encodeURIComponent(phone)}`);
        if (alive) setDetail(normaliseDetail(body, phone));
      } catch {
        if (!alive) return;
        setBackendReady(false);
        setDetail(normaliseDetail(null, phone));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [phone]);

  const badgeText = detail?.badge ? EYARA_BADGE_LABELS[detail.badge] || badgeLabel(detail.badge) || String(detail.badge) : "";
  const isRepeat = (detail?.totalOrders || 0) > 1;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Customers"
        title={loading ? "Customer details" : detail?.name || "Customer details"}
        subtitle={phone ? `Customer profile for ${phone}` : "Customer profile"}
        actions={
          <Button variant="ghost" href="/admin/customer_leaderboard">
            <FiArrowLeft aria-hidden="true" /> Back to Leaderboard
          </Button>
        }
      />

      {!backendReady && !loading && (
        <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
          <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Frontend only for now: no customer detail came back from the backend, so the sections below show
            empty states. Backend dev — wire <span className="num">GET /api/customers/:phone</span> (response
            shape documented in this file&apos;s header comment) and this page fills in unchanged. It is
            also fine to answer on <span className="num">/api/admin/customer-leaderboard/:phone</span> — tell
            the frontend dev which mount you chose.
          </span>
        </div>
      )}

      {loading || !detail ? (
        <Skeleton style={{ height: 420 }} />
      ) : (
        <>
          <div className="stat-grid stagger">
            <Stat label="Total Spent" value={formatMoney(detail.totalSpent)} tone="brand" />
            <Stat label="Total Orders" value={detail.totalOrders} tone="info" />
            <Stat label="Status" value={isRepeat ? "Repeat Customer" : "New Customer"} tone={isRepeat ? "success" : "neutral"} />
            <Stat label="Badge" value={badgeText || "No badge"} tone="neutral" />
          </div>

          <div className="grid-2" style={{ alignItems: "start" }}>
            <Card>
              <CardHeader title="Contact Information" />
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <FiPhone aria-hidden="true" /> <span>Phone:</span> <strong className="num">{detail.phone || "—"}</strong>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <FiMail aria-hidden="true" /> <span>Email:</span> <strong>{detail.email || "—"}</strong>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <FiMapPin aria-hidden="true" /> <span>District:</span> <strong>{detail.district || "—"}</strong>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <FiMapPin aria-hidden="true" style={{ marginTop: 3 }} /> <span>Address:</span> <strong>{detail.address || "—"}</strong>
                </li>
              </ul>
              {badgeText && (
                <p style={{ marginTop: 16 }}>
                  <Badge tone={badgeTone(detail.badge)}>{badgeText}</Badge>{" "}
                  <Badge tone={isRepeat ? "brand" : "neutral"}>{isRepeat ? "Repeat Customer" : "New Customer"}</Badge>
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Order Statistics" />
              <DataTable>
                <tbody>
                  <tr>
                    <td>Total Orders</td>
                    <td className="num" style={{ textAlign: "right" }}>
                      <strong>{detail.totalOrders}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>First Order</td>
                    <td style={{ textAlign: "right" }}>{detail.firstOrder ? formatDate(detail.firstOrder) : "—"}</td>
                  </tr>
                  <tr>
                    <td>Last Order</td>
                    <td style={{ textAlign: "right" }}>{detail.lastOrder ? formatDate(detail.lastOrder) : "—"}</td>
                  </tr>
                  <tr>
                    <td>Total Spent</td>
                    <td className="num" style={{ textAlign: "right" }}>
                      <strong>{formatMoney(detail.totalSpent)}</strong>
                    </td>
                  </tr>
                </tbody>
              </DataTable>
            </Card>
          </div>

          <Card>
            <CardHeader title={`Order History (${detail.orders.length})`} subtitle="Select an order to see its details and ordered items." />
            {detail.orders.length === 0 ? (
              <EmptyState title="No orders found" text="This customer's orders will appear here when the backend detail endpoint is connected." />
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {detail.orders.map((order, index) => {
                  const orderId = pick(order, ["id", "order_number", "orderNumber"]) ?? index;
                  const open = openOrder === String(orderId);
                  const items = orderItems(order);
                  const status = String(pick(order, ["status", "order_status"]) || "");
                  return (
                    <div key={String(orderId)} style={{ border: "1px solid var(--line)", borderRadius: 12 }}>
                      <button
                        type="button"
                        onClick={() => setOpenOrder(open ? null : String(orderId))}
                        aria-expanded={open}
                        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        <span>
                          <strong>Order #{orderId}</strong>
                          <span className="muted" style={{ marginLeft: 10 }}>
                            {formatDateTime(pick(order, ["created_at", "date", "ordered_at"]))}
                          </span>
                        </span>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {status && <Badge tone={status.toLowerCase() === "completed" || status.toLowerCase() === "delivered" ? "success" : status.toLowerCase() === "pending" ? "warn" : "neutral"}>{status}</Badge>}
                          <strong className="num">{formatMoney(pick(order, ["total", "grand_total", "total_amount"]))}</strong>
                          <FiChevronDown aria-hidden="true" className={cx(open && "is-open")} style={{ transform: open ? "rotate(180deg)" : undefined }} />
                        </span>
                      </button>

                      {open && (
                        <div style={{ padding: "0 16px 16px", display: "grid", gap: 14 }}>
                          <DataTable>
                            <tbody>
                              <tr>
                                <td>Payment Method:</td>
                                <td style={{ textAlign: "right" }}>{pick(order, ["payment_method", "paymentMethod"]) || "—"}</td>
                              </tr>
                              <tr>
                                <td>Shipping Cost:</td>
                                <td className="num" style={{ textAlign: "right" }}>
                                  {formatMoney(pick(order, ["shipping_cost", "shipping_fee", "shippingCost"]))}
                                </td>
                              </tr>
                              <tr>
                                <td>Subtotal:</td>
                                <td className="num" style={{ textAlign: "right" }}>
                                  {formatMoney(pick(order, ["subtotal", "sub_total"]))}
                                </td>
                              </tr>
                              <tr>
                                <td>Total:</td>
                                <td className="num" style={{ textAlign: "right" }}>
                                  <strong>{formatMoney(pick(order, ["total", "grand_total", "total_amount"]))}</strong>
                                </td>
                              </tr>
                              <tr>
                                <td>Notes:</td>
                                <td style={{ textAlign: "right" }}>{pick(order, ["notes", "note", "delivery_notes"]) || "—"}</td>
                              </tr>
                              <tr>
                                <td>Courier Entry:</td>
                                <td style={{ textAlign: "right" }}>{pick(order, ["courier_entry", "courier", "courier_name"]) || "—"}</td>
                              </tr>
                            </tbody>
                          </DataTable>

                          <div>
                            <h3 style={{ fontSize: "1rem", margin: "0 0 10px" }}>Ordered Items</h3>
                            {items.length === 0 ? (
                              <p className="muted" style={{ margin: 0 }}>No items were returned for this order.</p>
                            ) : (
                              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                                {items.map((item, itemIndex) => {
                                  const image = imgUrl(pick(item, ["colorImage", "image", "image_url"]));
                                  return (
                                    <li key={itemIndex} style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
                                      {image ? <Img src={image} alt="" width={44} height={54} sizes="44px" /> : null}
                                      <span style={{ flex: 1 }}>
                                        <strong style={{ display: "block" }}>{pick(item, ["title", "name", "product_name"]) || "Product"}</strong>
                                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                                          Qty: {pick(item, ["qty", "quantity"]) ?? 1}
                                          {pick(item, ["selected_size", "size"]) ? ` · Size: ${pick(item, ["selected_size", "size"])}` : ""}
                                        </span>
                                      </span>
                                      <span className="num">{formatMoney(pick(item, ["totalPrice", "total", "price", "unitPrice"]))}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="muted" style={{ fontSize: "0.88rem", marginTop: 14 }}>
              Looking for the ranked list instead? <Link href="/admin/customer_leaderboard">Open the Customer Leaderboard</Link>.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
