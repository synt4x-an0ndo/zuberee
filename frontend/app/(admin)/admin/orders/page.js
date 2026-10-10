"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { FaPen, FaReceipt, FaTruck, FaRepeat, FaChevronDown } from "react-icons/fa6";
import { api, formatTk, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import { ORDER_STATUSES } from "@/lib/orderStatuses";
import { normalizeOrders } from "@/lib/order";
import "@/styles/css/187416aab916025b.css";


/**
 * Orders (/dashboard/orders)
 *  - GET    api/orders?page=&status=&from=&to=&search=   -> {data:{data:[],current_page,last_page}}
 *  - PATCH  api/orders/{id}           {status, paymentStatus}
 *  - DELETE api/orders/{id}
 *  - POST   api/orders/{id}/courier-check  {} | {force_refresh:true}
 *  - POST   api/pathao/orders/{id}/create  {}
 *  - POST   api/customer-profiles/assign-badge {phone,name,badge_title}
 *  - GET    api/order-product-options (product picker)
 *  - GET    api/orders-download-csv?<filters>
 *  - GET    api/footer-settings/1 (invoice branding)
 */
function OrdersPage() {
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", from: "", to: "", search: "" });
  const [expanded, setExpanded] = useState(null); // order id
  const [courier, setCourier] = useState({}); // id -> loading
  const [badgeOrder, setBadgeOrder] = useState(null);

  const qs = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && p.append(k, v));
    return p.toString();
  }, [page, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get(`api/orders?${qs()}`);
      const d = r?.data?.data || r?.data || [];
      setRows(normalizeOrders(Array.isArray(d) ? d : []));
      setPager({
        current_page: r?.data?.current_page || 1,
        last_page: r?.data?.last_page || 1,
      });
    } catch (e) {
      setError(e.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (order, value) => {
    if (!value) return;
    try {
      await api.patch(`api/orders/${order.id}`, { status: value });
      notify.success("Order updated successfully.", "Order Updated");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to update status", "Could not update order");
    }
  };

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete order #${order.id}?`)) return;
    try {
      await api.delete(`api/orders/${order.id}`);
      notify.success("Order deleted.");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to delete order");
    }
  };

  const createCourier = async (order, courierKey) => {
    setCourier((c) => ({ ...c, [order.id]: true }));
    try {
      if (courierKey === "pathao") {
        const r = await api.post(`api/pathao/orders/${order.id}/create`, {});
        if (r?.success) {
          notify.success("Pathao courier entry created successfully!");
          load();
        } else {
          notify.error(r?.message || "Failed to create courier entry");
        }
      } else {
        notify.info("Steadfast integration coming soon");
      }
    } catch (e) {
      notify.error(e.message || "Courier entry failed");
    } finally {
      setCourier((c) => ({ ...c, [order.id]: false }));
    }
  };

  const [intel, setIntel] = useState(null); // {order, data, loading, error}

  const openIntelligence = async (order) => {
    setIntel({ order, data: null, loading: true, error: "" });
    try {
      const r = await api.post(`api/orders/${order.id}/courier-check`, {});
      setIntel({ order, data: r?.data || r, loading: false, error: "" });
    } catch (e) {
      setIntel({
        order,
        data: null,
        loading: false,
        error: e.message || "Courier check failed.",
      });
    }
  };

  const [csvUrl, setCsvUrl] = useState("");
  useEffect(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.append(k, v));
    setCsvUrl(`api/orders-download-csv${p.toString() ? `?${p}` : ""}`);
  }, [filters]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-0 fw-bold">Orders</h4>
          <small className="text-muted">Manage every order end to end</small>
        </div>
        <div className="d-flex gap-2">
          <a href={csvUrl} className="btn btn-sm btn-outline-success" download>
            Export CSV
          </a>
        </div>
      </div>

      {/* filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3 d-flex gap-2 flex-wrap align-items-center">
          <select
            className="form-select w-auto"
            value={filters.status}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, status: e.target.value }));
            }}
          >
            <option value="">All Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="form-control w-auto"
            value={filters.from}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, from: e.target.value }));
            }}
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            className="form-control w-auto"
            value={filters.to}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, to: e.target.value }));
            }}
          />
          <input
            className="form-control w-auto"
            style={{ maxWidth: 240 }}
            placeholder="Search name / phone"
            value={filters.search}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, search: e.target.value }));
            }}
          />
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setPage(1);
              setFilters({ status: "", from: "", to: "", search: "" });
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>District</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-danger">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  rows.map((o) => (
                    <Fragment key={o.id}>
                      <tr key={o.id}>
                        <td className="fw-bold">#{o.id}</td>
                        <td>
                          <div className="fw-semibold">{o.name || o.customer?.name}</div>
                          <small className="text-muted">{o.phone || o.customer?.phone}</small>
                          <div>
                            <button
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              onClick={() => openIntelligence(o)}
                            >
                              Customer intelligence
                            </button>
                          </div>
                        </td>
                        <td>{o.district}</td>
                        <td>
                          <small>
                            {o.created_at
                              ? new Date(o.created_at).toLocaleDateString("en-GB", {
                                timeZone: "Asia/Dhaka",
                              })
                              : "—"}
                          </small>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={String(o.status || "PENDING").toUpperCase().replace(/-/g, "_")}
                            onChange={(e) => updateStatus(o, e.target.value)}
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              title="Expand"
                              onClick={() =>
                                setExpanded(expanded === o.id ? null : o.id)
                              }
                            >
                              <FaChevronDown />
                              Expand
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              title="Repeat"
                              onClick={() => createCourier(o, "repeat")}
                            >
                              <FaRepeat />
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              title="Courier entry (Pathao)"
                              disabled={courier[o.id]}
                              onClick={() => createCourier(o, "pathao")}
                            >
                              <FaTruck />
                            </button>
                            <Link
                              href={`/admin/orders/invoice/${o.id}`}
                              className="btn btn-sm btn-outline-primary"
                            >
                              INVOICE
                            </Link>
                            <Link
                              href={`/admin/orders/edit/${o.id}`}
                              className="btn btn-sm btn-outline-warning"
                              title="Edit order"
                            >
                              <FaPen />
                            </Link>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Delete order"
                              onClick={() => deleteOrder(o)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === o.id && (
                        <tr>
                          <td colSpan={6} className="bg-light">
                            <OrderExpand
                              order={o}
                              onBadge={() => setBadgeOrder(o)}
                              onCourier={(k) => createCourier(o, k)}
                              courierLoading={courier[o.id]}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <small className="text-muted">
            Page {pager.current_page} of {pager.last_page}
          </small>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= pager.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* expanded order details */}
      {/* courier intelligence modal */}
      {intel && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: "rgba(0,0,0,.5)", zIndex: 1040 }}
            onClick={() => setIntel(null)}
          />
          <div
            className="position-fixed start-50 top-50 translate-middle bg-white rounded shadow p-4"
            style={{ zIndex: 1050, width: "min(560px, 92vw)", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 fw-bold">Courier delivery profile</h5>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setIntel(null)}>
                Done
              </button>
            </div>
            {intel.loading ? (
              <p className="text-muted">
                <span className="spinner-border spinner-border-sm me-2" />
                We’re securely retrieving this customer’s courier records.
              </p>
            ) : intel.error ? (
              <div className="alert alert-warning mb-0">
                We couldn’t complete the check — {intel.error}
              </div>
            ) : (
              <div>
                <h6>Network view</h6>
                <p className="small text-muted mb-1">
                  Customer: {intel.order.name} • {intel.order.phone}
                </p>
                <h6 className="mt-3">Courier breakdown</h6>
                <pre className="small bg-light p-2 rounded" style={{ maxHeight: 220, overflow: "auto" }}>
                  {JSON.stringify(intel.data, null, 2)}
                </pre>
                <small className="text-muted">
                  No courier-specific history was returned. / Risk signals / Merchant
                  reports as provided by the API.
                </small>
              </div>
            )}
          </div>
        </>
      )}

      {/* badge modal */}
      {badgeOrder && (
        <BadgeModal
          order={badgeOrder}
          onClose={() => setBadgeOrder(null)}
          onSaved={() => {
            setBadgeOrder(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ---------- expanded row content ---------- */
function OrderExpand({ order, onBadge, onCourier, courierLoading }) {
  const items = order.items || order.order_items || order.cart_items || [];
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.totalPrice ?? it.total ?? 0) || 0),
    0
  );
  const shipping = Number(order.shipping_cost) || 0;
  const advance = Number(order.advance_payment) || 0;

  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="card border">
          <div className="card-header bg-white py-2 fw-bold">Ordered Products</div>
          <div className="card-body">
            {items.map((it, i) => (
              <div key={i} className="d-flex justify-content-between mb-2">
                <div>
                  <b>{it.title}</b>
                  <div className="small text-muted">
                    {it.color_name || it.color ? `Color: ${it.color_name || it.color}` : ""}{" "}
                    {it.size ? `Size: ${it.size}` : ""} × {it.qty}
                  </div>
                </div>
                <div className="fw-semibold">{formatTk(it.totalPrice ?? it.total)}৳</div>
              </div>
            ))}
            <hr />
            <div className="d-flex justify-content-between">
              <span>Order Summary</span>
            </div>
            <div className="d-flex justify-content-between small">
              <span>Subtotal</span>
              <span>{formatTk(subtotal)}৳</span>
            </div>
            <div className="d-flex justify-content-between small">
              <span>Shipping</span>
              <span>{formatTk(shipping)}৳</span>
            </div>
            <div className="d-flex justify-content-between small">
              <span>Advance Payment</span>
              <span>{formatTk(advance)}৳</span>
            </div>
            <div className="d-flex justify-content-between fw-bold">
              <span>Total</span>
              <span>{formatTk(subtotal + shipping - advance)}৳</span>
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-5">
        <div className="card border">
          <div className="card-header bg-white py-2 fw-bold">Manage Order</div>
          <div className="card-body small">
            <p className="mb-1">
              <b>Status:</b> {order.status}
            </p>
            <p className="mb-1">
              <b>Payment:</b> {order.payment_method}
            </p>
            <p className="mb-1">
              <b>Address:</b> {order.address}, {order.district}
            </p>
            {order.delivery_notes && (
              <p className="mb-1">
                <b>Notes:</b> {order.delivery_notes}
              </p>
            )}
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={onBadge}>
                Assign Customer Badge
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                disabled={courierLoading}
                onClick={() => onCourier("pathao")}
              >
                {order.pathao_order_id ? "✓ Entry Created" : "Entry Pathao"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- badge modal ---------- */
function BadgeModal({ order, onClose, onSaved }) {
  const [title, setTitle] = useState(order.assigned_badge?.title || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("api/customer-profiles/assign-badge", {
        phone: order.phone,
        name: order.name,
        badge_title: title || null,
      });
      notify.success("Badge saved successfully");
      onSaved();
    } catch (e) {
      notify.error(e.message || "Failed to save badge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{ background: "rgba(0,0,0,.5)", zIndex: 1040 }}
        onClick={onClose}
      />
      <div
        className="position-fixed start-50 top-50 translate-middle bg-white rounded shadow p-4"
        style={{ zIndex: 1050, width: "min(420px, 92vw)" }}
      >
        <h5 className="fw-bold mb-3">Badge</h5>
        <input
          className="form-control mb-3"
          placeholder="Badge title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-grad" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function OrdersAdminPage() {
  return (
    <PageGate permission="view orders">
      <OrdersPage />
    </PageGate>
  );
}
