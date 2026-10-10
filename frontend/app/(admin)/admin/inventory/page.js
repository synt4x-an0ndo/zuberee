"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa6";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

import "@/styles/css/19b7b7f3433c440d.css";

const STATUS_META = {
  inactive: { label: "Inactive", cls: "inv-badge inv-badge-muted" },
  in_stock: { label: "In stock", cls: "inv-badge inv-badge-ok" },
  low: { label: "Low", cls: "inv-badge inv-badge-warn" },
  pre_order: { label: "Pre-order", cls: "inv-badge inv-badge-info" },
  out: { label: "Out", cls: "inv-badge inv-badge-danger" },
};

/**
 * Inventory (/dashboard/inventory)
 *  - GET    api/inventory/summary                          (enforcement flag etc.)
 *  - GET    api/inventory/variants?page=&per_page=&search=
 *  - GET    api/inventory/products, api/inventory/sizes
 *  - POST   api/inventory/stock-in   {note, lines:[{product_variant_id,qty,unit_cost}]}
 *  - POST   api/inventory/adjust     {product_variant_id, stock, type, note}
 *  - PUT    api/site-settings        {inventory_enforcement_enabled}
 *  - GET/PUT api/inventory/products/{id}/matrix (per-product matrix editor)
 */
function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [enforcement, setEnforcement] = useState(false);

  /* modals */
  const [showReceive, setShowReceive] = useState(false);
  const [adjustRow, setAdjustRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(
        `api/inventory/variants?page=${page}&per_page=25${query ? `&search=${encodeURIComponent(query)}` : ""
        }${trackedOnly ? "&tracked=1" : ""}`
      );
      const d = r?.data?.data || r?.data || [];
      setRows(Array.isArray(d) ? d : []);
      setPager({
        current_page: r?.data?.current_page || 1,
        last_page: r?.data?.last_page || 1,
        total: r?.data?.total || 0,
      });
    } catch (e) {
      notify.error(e.message || "Failed to load inventory");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, query, trackedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== query) {
        setPage(1);
        setQuery(search);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [search, query]);

  /* enforcement flag */
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/site-settings", { auth: false });
        setEnforcement(!!r?.data?.inventory_enforcement_enabled);
      } catch { }
    })();
  }, []);

  const toggleEnforcement = async () => {
    const next = !enforcement;
    const res = await Swal.fire({
      title: next
        ? "Start blocking out-of-stock orders?"
        : "Stop enforcing stock limits?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#7d0ba7",
      confirmButtonText: "Confirm",
    });
    if (!res.isConfirmed) return;
    try {
      await api.put("api/site-settings", { inventory_enforcement_enabled: next });
      setEnforcement(next);
      notify.success("Inventory enforcement updated");
    } catch (e) {
      notify.error(e.message || "Failed to update setting");
    }
  };

  return (
    <div className="inv-page">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-0 fw-bold">Inventory</h4>
          <small className="text-muted">
            Stock rows are created automatically when you save a product that has
            colours or sizes.
          </small>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            className={`inv-chip ${trackedOnly ? "inv-chip-active" : ""}`}
            onClick={() => {
              setPage(1);
              setTrackedOnly((v) => !v);
            }}
          >
            Tracked only
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={toggleEnforcement}
          >
            {enforcement ? "Enforcing stock: ON" : "Enforcing stock: OFF"}
          </button>
          <button className="btn btn-grad btn-sm" onClick={() => setShowReceive(true)}>
            <FaPlus className="me-1" /> Receive Stock
          </button>
          <Link href="/admin/inventory/movements" className="btn btn-sm btn-outline-primary">
            Stock History
          </Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="input-group" style={{ maxWidth: 340 }}>
            <input
              className="form-control"
              placeholder="Search product or variant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>On hand</th>
                  <th>Held</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No inventory rows. not tracked products are excluded from this grid.
                    </td>
                  </tr>
                ) : (
                  rows.map((v, i) => {
                    const st = STATUS_META[v.status] || {
                      label: v.status || "—",
                      cls: "inv-badge inv-badge-muted",
                    };
                    return (
                      <tr key={v.id ?? i}>
                        <td className="fw-semibold">{v.product_title || v.product?.title}</td>
                        <td>{v.variant_label || [v.color_name, v.size].filter(Boolean).join(" / ") || "—"}</td>
                        <td>{v.stock ?? v.on_hand ?? 0}</td>
                        <td>{v.held ?? 0}</td>
                        <td>{v.available ?? Math.max(0, (v.stock ?? 0) - (v.held ?? 0))}</td>
                        <td>
                          <span className={st.cls}>{st.label}</span>
                        </td>
                        <td>
                          <button
                            className="inv-btn inv-btn-sm inv-btn-ghost"
                            onClick={() => setAdjustRow(v)}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <small className="text-muted">
            Page {pager.current_page} of {pager.last_page} • {pager.total} variants
          </small>
          <div className="d-flex gap-2">
            <button
              className="inv-btn inv-btn-ghost inv-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="inv-btn inv-btn-ghost inv-btn-sm"
              disabled={page >= pager.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showReceive && (
        <ReceiveModal
          onClose={() => setShowReceive(false)}
          onDone={() => {
            setShowReceive(false);
            load();
          }}
        />
      )}
      {adjustRow && (
        <AdjustModal
          row={adjustRow}
          onClose={() => setAdjustRow(null)}
          onDone={() => {
            setAdjustRow(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Receive stock modal ---------------- */
function ReceiveModal({ onClose, onDone }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState([]);
  const [lines, setLines] = useState({}); // variant_id -> {qty, unit_cost}
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/inventory/products");
        const products = r?.data?.data ?? r?.data;
        setProducts(Array.isArray(products) ? products : []);
      } catch {
        notify.error("Could not load products");
      }
    })();
  }, []);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const r = await api.get(`api/inventory/products/${productId}/matrix`);
        setVariants(r?.data?.variants || r?.data || []);
      } catch {
        setVariants([]);
      }
    })();
  }, [productId]);

  const submit = async () => {
    const arr = Object.entries(lines)
      .filter(([, l]) => Number(l.qty) > 0)
      .map(([vid, l]) => ({
        product_variant_id: Number(vid),
        qty: Number(l.qty),
        unit_cost: l.unit_cost === "" || l.unit_cost == null ? null : Number(l.unit_cost),
      }));
    if (!arr.length) {
      notify.warn?.("Enter a quantity for at least one variant");
      return;
    }
    setSaving(true);
    try {
      const total = arr.reduce((s, l) => s + l.qty, 0);
      await api.post("api/inventory/stock-in", { note: note || null, lines: arr });
      notify.success(`Received ${total} unit${total > 1 ? "s" : ""}`);
      onDone();
    } catch (e) {
      notify.error(e.message || "Could not receive stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inv-modal-backdrop" onClick={onClose}>
      <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv-modal-head">
          <div>
            <h5 className="mb-0 fw-bold">Receive Stock</h5>
            <small className="text-muted">
              Add newly arrived units. Existing counts go up, nothing is overwritten.
            </small>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="inv-modal-body">
          <div className="mb-3">
            <label className="form-label fw-semibold">Product</label>
            <select
              className="form-select"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">— Select a product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {productId && (
            <div className="mb-3">
              <label className="form-label fw-semibold">Variant</label>
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th style={{ width: 110 }}>Qty</th>
                    <th style={{ width: 130 }}>Unit cost</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(variants) ? variants : []).map((v) => (
                    <tr key={v.id}>
                      <td>{v.variant_label || [v.color_name, v.size].filter(Boolean).join(" / ") || v.id}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="form-control form-control-sm"
                          value={lines[v.id]?.qty ?? ""}
                          onChange={(e) =>
                            setLines((l) => ({
                              ...l,
                              [v.id]: { ...l[v.id], qty: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control form-control-sm"
                          placeholder="optional"
                          value={lines[v.id]?.unit_cost ?? ""}
                          onChange={(e) =>
                            setLines((l) => ({
                              ...l,
                              [v.id]: { ...l[v.id], unit_cost: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-semibold">Reference / note</label>
            <input
              className="form-control"
              placeholder="Shows up in the stock history."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="inv-modal-foot">
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-grad" disabled={saving} onClick={submit}>
            {saving ? "Receiving..." : "Receive"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Adjust modal ---------------- */
function AdjustModal({ row, onClose, onDone }) {
  const current = row.stock ?? row.on_hand ?? 0;
  const [stock, setStock] = useState(String(current));
  const [type, setType] = useState("adjustment");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const delta = Number(stock) - Number(current);

  const submit = async () => {
    if (!note.trim()) {
      notify.warn?.("Add a short reason so the history makes sense later");
      return;
    }
    setSaving(true);
    try {
      await api.post("api/inventory/adjust", {
        product_variant_id: row.product_variant_id ?? row.id,
        stock: Number(stock),
        type,
        note: note.trim(),
      });
      notify.success("Stock updated");
      onDone();
    } catch (e) {
      notify.error(e.message || "Could not update stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inv-modal-backdrop" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="inv-modal-head">
          <div>
            <h5 className="mb-0 fw-bold">Adjust stock</h5>
            <small className="text-muted">
              On hand {current} • Held {row.held ?? 0} • Available {row.available ?? current}
            </small>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="inv-modal-body">
          <div className="mb-3">
            <label className="form-label fw-semibold">New on-hand count</label>
            <input
              type="number"
              className="form-control"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
            <small className={delta < 0 ? "text-danger" : "text-success"}>
              {delta >= 0 ? "+" : ""}
              {delta} change
            </small>
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold">Reason type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="adjustment">Adjustment</option>
              <option value="recount">Recount / correction</option>
              <option value="damaged">Damaged or lost</option>
              <option value="purchase">Purchase not logged earlier</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold">Note</label>
            <textarea
              rows={2}
              className="form-control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="inv-modal-foot">
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-grad" disabled={saving} onClick={submit}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryAdminPage() {
  return (
    <PageGate permission="manage inventory">
      <InventoryPage />
    </PageGate>
  );
}
