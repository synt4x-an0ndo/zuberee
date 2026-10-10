"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatTk, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import { ORDER_STATUSES } from "@/lib/orderStatuses";

/**
 * Incomplete checkouts (/dashboard/incomplete_orders)
 *  - GET  api/abandoned-checkouts?page=&start_date=&end_date=&status=
 *         -> {data:{data:[...],current_page,last_page}}  (rows filtered client-side
 *            to !is_recovered && !converted_order_id)
 *  - PUT  api/dashboard/abandoned-checkouts/{id}/status  {status}
 *  - POST api/dashboard/abandoned-checkouts/{id}/convert {...form}
 *  - GET  api/shipping-costs-latest  (default shipping for conversion form)
 */
function IncompleteOrders() {
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start_date: "", end_date: "", status: "" });
  const [convertRow, setConvertRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page) });
      Object.entries(filters).forEach(([k, v]) => v && p.append(k, v));
      const r = await api.get(`api/abandoned-checkouts?${p.toString()}`);
      const inner = r?.data?.data || r?.data || [];
      const list = (Array.isArray(inner) ? inner : inner.data || []).filter(
        (c) => !c.is_recovered && !c.converted_order_id
      );
      setRows(list);
      setPager({
        current_page: r?.data?.data?.current_page || r?.data?.current_page || 1,
        last_page: r?.data?.data?.last_page || r?.data?.last_page || 1,
      });
    } catch (e) {
      notify.error(e.message || "Failed to load checkouts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (row, status) => {
    try {
      const r = await api.put(`api/dashboard/abandoned-checkouts/${row.id}/status`, {
        status,
      });
      notify.success(r?.message || "Status updated successfully");
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, status } : x)));
    } catch (e) {
      notify.error(e.message || "Failed to update status");
    }
  };

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-3">Incomplete checkout</h4>

      {/* filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3 d-flex gap-2 flex-wrap align-items-end">
          <div>
            <label className="form-label small mb-1">Start Date</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filters.start_date}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, start_date: e.target.value }));
              }}
            />
          </div>
          <div>
            <label className="form-label small mb-1">End Date</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filters.end_date}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, end_date: e.target.value }));
              }}
            />
          </div>
          <div>
            <label className="form-label small mb-1">Status</label>
            <select
              className="form-select form-select-sm"
              value={filters.status}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, status: e.target.value }));
              }}
            >
              <option value="">All</option>
              <option value="incomplete">Incomplete</option>
              <option value="converted">Converted</option>
              {ORDER_STATUSES.slice(0, 6).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setPage(1);
              setFilters({ start_date: "", end_date: "", status: "" });
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Cart Items</th>
                  <th>Conversion</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      No incomplete orders found
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td className="fw-semibold">{c.name || "—"}</td>
                      <td>{c.phone}</td>
                      <td>
                        <small>{c.address || "—"}</small>
                      </td>
                      <td>
                        {(c.cart_items || []).length || "No items"}
                        {c.conversion !== undefined && (
                          <span
                            className={`badge ms-2 ${
                              c.conversion ? "bg-success" : "bg-warning text-dark"
                            }`}
                          >
                            {c.conversion ? "Converted" : "Incomplete"}
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={c.status || "incomplete"}
                          onChange={(e) => setStatus(c, e.target.value)}
                        >
                          <option value="incomplete">Incomplete</option>
                          <option value="contacted">Contacted</option>
                          <option value="recovered">Recovered</option>
                        </select>
                      </td>
                      <td>
                        <small>
                          {c.created_at
                            ? new Date(c.created_at).toLocaleString("en-GB", {
                                timeZone: "Asia/Dhaka",
                              })
                            : "—"}
                        </small>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-grad"
                          onClick={() => setConvertRow(c)}
                        >
                          Convert to Order
                        </button>
                      </td>
                    </tr>
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

      {convertRow && (
        <ConvertModal
          row={convertRow}
          onClose={() => setConvertRow(null)}
          onDone={() => {
            setConvertRow(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------- convert-to-order modal ------------- */
function ConvertModal({ row, onClose, onDone }) {
  const [shipping, setShipping] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: row.name || "",
    phone: row.phone || "",
    payment_method: row.payment_method || "cash",
    district: row.district || "",
    address: row.address || "",
    delivery_notes: row.delivery_notes || "",
    shipping_cost: row.shipping_cost ?? "",
    advance_payment: row.advance_payment ?? 0,
  });
  const [items, setItems] = useState(
    (row.cart_items || []).map((it) => ({
      ...it,
      product_id: it.product_id ?? it.id,
      title: it.title,
      size_id: it.size_id ?? "",
      size: it.size,
      color: it.color,
      color_name: it.color_name,
      image: it.image,
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      qty: Number(it.qty ?? 1),
      totalPrice: Number(it.totalPrice ?? it.price ?? 0),
    }))
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/shipping-costs-latest", { auth: false });
        setShipping(r?.data || r);
        if (!form.district && r?.data) {
          const d = (row.district || "").toLowerCase();
          const cost =
            d === "dhaka"
              ? r.data.inside_dhaka ?? r.data.one_shipping_cost
              : r.data.outside_dhaka ?? r.data.one_shipping_cost;
          if (cost != null && form.shipping_cost === "")
            setForm((f) => ({ ...f, shipping_cost: cost }));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const subtotal = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);

  const submit = async () => {
    if (!form.name || !form.phone || !form.address || !form.district) {
      notify.error("Customer Name, Phone, District and Address are required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        payment_method: form.payment_method,
        district: form.district,
        address: form.address,
        delivery_notes: form.delivery_notes,
        shipping_cost: Number(form.shipping_cost) || 0,
        advance_payment: Number(form.advance_payment) || 0,
        cart: items.map((it) => ({
          id: Number(it.id),
          product_id: Number(it.product_id),
          title: it.title,
          size_id: it.size_id ? Number(it.size_id) : null,
          color: it.color,
          unitPrice: Number(it.unitPrice) || 0,
          qty: Number(it.qty) || 1,
          totalPrice: Number(it.totalPrice) || 0,
        })),
      };
      const r = await api.post(
        `api/dashboard/abandoned-checkouts/${row.id}/convert`,
        body
      );
      notify.success(r?.message || "Converted to order successfully");
      onDone();
    } catch (e) {
      notify.error(e.message || "Conversion failed");
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
        className="position-fixed start-50 top-50 translate-middle bg-white rounded shadow"
        style={{
          zIndex: 1050,
          width: "min(760px, 94vw)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="fw-bold mb-0">Incomplete checkout</h5>
              <small className="text-muted">
                Review customer details, selected variants, and delivery cost.
              </small>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>

          <h6 className="fw-bold">Customer &amp; delivery</h6>
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label small">Customer Name *</label>
              <input
                className="form-control"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small">Phone *</label>
              <input
                className="form-control"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Payment Method *</label>
              <select
                className="form-select"
                value={form.payment_method}
                onChange={(e) => set("payment_method", e.target.value)}
              >
                <option value="cash">Cash on Delivery</option>
                <option value="bkash">Bkash</option>
                <option value="card">Card Payment</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">District *</label>
              <input
                className="form-control"
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Shipping Cost *</label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-control"
                  value={form.shipping_cost}
                  onChange={(e) => set("shipping_cost", e.target.value)}
                />
                <span className="input-group-text">TK</span>
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Advance Payment</label>
              <input
                type="number"
                className="form-control"
                value={form.advance_payment}
                onChange={(e) => set("advance_payment", e.target.value)}
              />
            </div>
            <div className="col-md-8">
              <label className="form-label small">Address *</label>
              <input
                className="form-control"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="col-12">
              <label className="form-label small">Delivery Notes</label>
              <input
                className="form-control"
                value={form.delivery_notes}
                onChange={(e) => set("delivery_notes", e.target.value)}
              />
            </div>
          </div>

          <h6 className="fw-bold">Order items</h6>
          <small className="text-muted d-block mb-2">
            Size and color are prefilled from the customer&apos;s checkout selection.
          </small>
          <div className="table-responsive mb-3">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product ID *</th>
                  <th>Title *</th>
                  <th>Size</th>
                  <th>Unit Price *</th>
                  <th>Qty *</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      {it.image ? (
                        <img
                          src={imgUrl(it.image)}
                          alt=""
                          width={40}
                          height={40}
                          style={{ objectFit: "cover", borderRadius: 4 }}
                        />
                      ) : (
                        <small className="text-muted">No image</small>
                      )}
                    </td>
                    <td>{it.product_id}</td>
                    <td>
                      <div className="small fw-semibold">{it.title}</div>
                      <small className="text-muted">{it.color_name}</small>
                    </td>
                    <td>
                      <small>{it.size || "—"}</small>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        style={{ width: 100 }}
                        value={it.unitPrice}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setItems((list) => {
                            const n = [...list];
                            n[i] = {
                              ...n[i],
                              unitPrice: v,
                              totalPrice: v * Number(n[i].qty),
                            };
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        className="form-control form-control-sm"
                        style={{ width: 70 }}
                        value={it.qty}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 1;
                          setItems((list) => {
                            const n = [...list];
                            n[i] = {
                              ...n[i],
                              qty: v,
                              totalPrice: v * Number(n[i].unitPrice),
                            };
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="fw-semibold">{formatTk(it.totalPrice)}৳</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() =>
                          setItems((list) => list.filter((_, j) => j !== i))
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted small">
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center">
            <div>
              Subtotal: <b>{formatTk(subtotal)}৳</b> • Shipping:{" "}
              <b>{formatTk(form.shipping_cost)}৳</b>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-grad" disabled={saving} onClick={submit}>
                {saving ? "Converting..." : "Convert to Order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function IncompleteOrdersPage() {
  return (
    <PageGate permission="view orders">
      <IncompleteOrders />
    </PageGate>
  );
}
