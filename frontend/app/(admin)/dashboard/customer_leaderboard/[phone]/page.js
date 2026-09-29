"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, formatTk } from "@/lib/api";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Customer details (/dashboard/customer_leaderboard/{phone})
 *  - GET api/customers/{phone}
 *      -> {success, data:{name,phone,email,district,address,badge,
 *        total_spent,total_orders,first_order_date,last_order_date,
 *        orders:[{id,created_at,status,payment_method,shipping_cost,
 *                 total/items:[{title,qty,unitPrice,totalPrice,size,color}]}]}}
 */
function CustomerDetail({ phone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`api/customers/${encodeURIComponent(phone)}`);
        if (r?.success && r.data && alive) setData(r.data);
        else if (alive) setMissing(true);
      } catch {
        if (alive) setMissing(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [phone]);

  if (loading) return <Loader />;
  if (missing || !data)
    return <div className="text-center py-5 text-muted">Customer not found</div>;

  const orders = data.orders || data.recent_orders || [];

  return (
    <div className="container-fluid py-4">
      <Link
        href="/dashboard/customer_leaderboard"
        className="btn btn-outline-primary mb-3"
      >
        ← Back to Leaderboard
      </Link>

      <div className="row g-3">
        {/* profile */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="fw-bold mb-0">{data.name}</h5>
                  <span
                    className={`badge mt-1 ${
                      data.badge === "new" ? "bg-warning" : "bg-success"
                    }`}
                  >
                    {data.badge === "new" ? "New" : "Repeat"}
                  </span>
                </div>
              </div>
              <h6 className="text-primary">Total Spent</h6>
              <h4 className="fw-bold mb-3">{formatTk(data.total_spent)}৳</h4>

              <h6 className="fw-bold">Contact Information</h6>
              <p className="mb-1 small">Phone: {data.phone}</p>
              <p className="mb-1 small">Email: {data.email || "—"}</p>
              <p className="mb-1 small">District: {data.district || "—"}</p>
              <p className="mb-3 small">Address: {data.address || "—"}</p>

              <h6 className="fw-bold">Order Statistics</h6>
              <div className="d-flex justify-content-between small mb-1">
                <span>Total Orders</span>
                <b>{data.total_orders}</b>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>First Order</span>
                <b>{data.first_order_date ? String(data.first_order_date).slice(0, 10) : "—"}</b>
              </div>
              <div className="d-flex justify-content-between small">
                <span>Last Order</span>
                <b>{data.last_order_date ? String(data.last_order_date).slice(0, 10) : "—"}</b>
              </div>
            </div>
          </div>
        </div>

        {/* orders */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-bold">Order Details</div>
            <div className="card-body">
              {orders.length === 0 ? (
                <p className="text-muted mb-0">No orders found</p>
              ) : (
                orders.map((o) => {
                  const items = o.items || o.order_items || o.cart_items || [];
                  const subtotal = items.reduce(
                    (s, it) => s + (Number(it.totalPrice ?? it.total ?? 0) || 0),
                    0
                  );
                  return (
                    <div key={o.id} className="border rounded p-3 mb-3">
                      <div className="d-flex justify-content-between flex-wrap gap-2">
                        <div>
                          <b>Order #{o.id}</b>{" "}
                          <span className="badge bg-secondary">{o.status}</span>
                          <div className="small text-muted">
                            {o.created_at
                              ? new Date(o.created_at).toLocaleDateString("en-GB", {
                                  timeZone: "Asia/Dhaka",
                                })
                              : ""}
                          </div>
                        </div>
                        <div className="text-end small">
                          <div>Payment Method: {o.payment_method}</div>
                          <div>Shipping Cost: {formatTk(o.shipping_cost)}৳</div>
                          <div>
                            Subtotal: {formatTk(subtotal)}৳ • Total:{" "}
                            <b>{formatTk(o.total_amount ?? subtotal)}৳</b>
                          </div>
                          {o.delivery_notes && <div>Notes: {o.delivery_notes}</div>}
                          {o.pathao_order_id && (
                            <div>Courier Entry: Pathao #{o.pathao_order_id}</div>
                          )}
                        </div>
                      </div>
                      <div className="table-responsive mt-2">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Ordered Items</th>
                              <th>Quantity</th>
                              <th>Unit Price</th>
                              <th>Total Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, i) => (
                              <tr key={i}>
                                <td>
                                  {it.title}
                                  <div className="small text-muted">
                                    {[it.color_name || it.color, it.size]
                                      .filter(Boolean)
                                      .join(" / ")}
                                  </div>
                                </td>
                                <td>{it.qty}</td>
                                <td>{formatTk(it.unitPrice ?? it.price)}৳</td>
                                <td>{formatTk(it.totalPrice ?? it.total)}৳</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDetailPage({ params }) {
  const { phone } = use(params);
  return (
    <PageGate permission="view leaderboard">
      <CustomerDetail phone={decodeURIComponent(phone)} />
    </PageGate>
  );
}
