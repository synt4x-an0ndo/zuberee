"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiEdit2, FiPlus, FiPrinter, FiSearch, FiTag, FiTrash2, FiTruck, FiX } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, EmptyState, ErrorState, Input, Pagination, Select, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney } from "@/lib/api";
import { DISTRICTS } from "@/lib/districts";
import { badgePath } from "@/lib/customers";
import { ORDER_STATUS_OPTIONS, formatDateTime, formatOrderNumber, orderStatusMeta } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const EMPTY = { search: "", status: "", district: "", from: "", to: "" };
const BADGE_OPTIONS = ["VIP", "Repeat Customer", "Priority", "High Value"];

/** key accepted by PATCH /api/admin/customer-leaderboard/:key/badge */
function customerKey(order) {
  const userId = order?.user_id ?? order?.userId;
  if (userId !== undefined && userId !== null && userId !== "") return `user:${userId}`;
  const phone = String(order?.phone ?? "").trim();
  if (phone) return `guest:${phone}`;
  return "";
}

function apiBadgeValue(order) {
  const badge = order?.customer_badge ?? order?.customerBadge ?? order?.badge;
  if (typeof badge === "string") return badge;
  return badge?.label ?? badge?.name ?? "";
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [liveDistricts, setLiveDistricts] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [activeDialog, setActiveDialog] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [badgeDraft, setBadgeDraft] = useState("");
  const [badgeAssignments, setBadgeAssignments] = useState({});
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [courierResult, setCourierResult] = useState(null);
  const [courierError, setCourierError] = useState("");
  const [courierChecking, setCourierChecking] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const selectAllRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setApplied((prev) => ({ ...prev, search: filters.search })), 350);
    return () => clearTimeout(t);
  }, [filters.search]);

  /**
   * District filter options come from the orders that actually exist
   * (GET /api/admin/orders/districts). Falls back to the full BD district list
   * while the request is in flight or if it fails, so the filter never goes blank.
   */
  useEffect(() => {
    let alive = true;
    api
      .get("api/admin/orders/districts")
      .then((body) => {
        if (!alive) return;
        const list = Array.isArray(body?.data) ? body.data : [];
        setLiveDistricts(list.filter((d) => typeof d === "string" && d.trim()));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const districtOptions = useMemo(() => {
    if (!liveDistricts.length) return DISTRICTS;
    const known = new Map(DISTRICTS.map((d) => [d.value, d.label]));
    return liveDistricts.map((value) => ({
      value,
      label: known.get(value) || value.replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }, [liveDistricts]);

  const { data, loading, error, reload } = useAsync(async () => {
    const params = { page, per_page: 15 };
    if (applied.search.trim()) params.search = applied.search.trim();
    if (applied.status) params.status = applied.status;
    if (applied.district) params.district = applied.district;
    if (applied.from) params.from = applied.from;
    if (applied.to) params.to = applied.to;
    const body = await api.get("api/admin/orders", { params });
    return { orders: Array.isArray(body.data) ? body.data : [], meta: body.meta || {} };
  }, [page, applied]);
  const visibleOrders = data?.orders || [];
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((order) =>
    selectedOrders.some((selected) => String(selected.id) === String(order.id))
  );
  const someVisibleSelected = visibleOrders.some((order) =>
    selectedOrders.some((selected) => String(selected.id) === String(order.id))
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  useEffect(() => {
    if (!activeDialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setActiveDialog(null);
        setActiveOrder(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeDialog]);

  const set = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    if (key !== "search") {
      setApplied((a) => ({ ...a, [key]: e.target.value }));
      setPage(1);
    }
  };

  const isSelected = (order) => selectedOrders.some((selected) => String(selected.id) === String(order.id));

  const toggleOrderSelection = (order) => {
    const orderId = String(order.id);
    setSelectedOrders((current) => current.some((selected) => String(selected.id) === orderId)
      ? current.filter((selected) => String(selected.id) !== orderId)
      : [...current, order]
    );
  };

  const toggleVisibleSelection = () => {
    const visibleIds = new Set(visibleOrders.map((order) => String(order.id)));
    setSelectedOrders((current) => {
      if (allVisibleSelected) return current.filter((order) => !visibleIds.has(String(order.id)));
      const next = [...current];
      for (const order of visibleOrders) {
        if (!next.some((selected) => String(selected.id) === String(order.id))) next.push(order);
      }
      return next;
    });
  };

  const assignedBadge = (order) => {
    const key = customerKey(order);
    return Object.prototype.hasOwnProperty.call(badgeAssignments, key)
      ? badgeAssignments[key]
      : apiBadgeValue(order);
  };

  const openBadgeDialog = (order) => {
    const key = customerKey(order);
    setBadgeDraft(Object.prototype.hasOwnProperty.call(badgeAssignments, key)
      ? badgeAssignments[key]
      : apiBadgeValue(order)
    );
    setActiveOrder(order);
    setActiveDialog("badge");
  };

  const openCourierDialog = (order) => {
    setCourierResult(null);
    setCourierError("");
    setActiveOrder(order);
    setActiveDialog("courier");
  };

  /** POST /api/admin/fraud-checker/check — live courier history for the order's phone number. */
  const runCourierCheck = async () => {
    const phone = String(activeOrder?.phone ?? "").trim();
    if (!phone) {
      setCourierError("This order has no phone number to check.");
      return;
    }
    setCourierChecking(true);
    setCourierError("");
    setCourierResult(null);
    try {
      const body = await api.post("api/admin/fraud-checker/check", { phone });
      setCourierResult(body.data ?? body);
    } catch (err) {
      setCourierError(err.message);
    } finally {
      setCourierChecking(false);
    }
  };

  const closeActionDialog = () => {
    setActiveDialog(null);
    setActiveOrder(null);
  };

  const saveBadge = async () => {
    if (!activeOrder) return;
    const key = customerKey(activeOrder);
    if (!key) {
      toast.error("This order has neither a linked account nor a phone number, so a badge cannot be assigned.");
      return;
    }
    setBadgeSaving(true);
    try {
      await api.patch(badgePath(key), { badge: badgeDraft ? badgeDraft : null });
      setBadgeAssignments((current) => ({ ...current, [key]: badgeDraft }));
      toast.success(`Badge saved for ${activeOrder.name || activeOrder.phone || "customer"}.`);
      closeActionDialog();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBadgeSaving(false);
    }
  };

  /**
   * DELETE /api/admin/orders/:id — the backend removes the order and its items, so this is
   * always confirmed first and the list is reloaded afterwards. The route answers
   * {"success":false,"message":"Order not found."} when the row is already gone.
   */
  const deleteOrder = async (order) => {
    const ok = await confirm({
      title: "Delete this order?",
      message: `${formatOrderNumber(order)} for ${order.name || "Guest"} and all of its items will be removed permanently. This cannot be undone.`,
      confirmText: "Delete order",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(order.id);
    try {
      await api.delete(`api/admin/orders/${order.id}`);
      setSelectedOrders((current) => current.filter((selected) => String(selected.id) !== String(order.id)));
      toast.success(`${formatOrderNumber(order)} deleted.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const downloadCsv = async () => {
    setExportError("");
    setExporting(true);
    try {
      let rows = selectedOrders;
      if (rows.length === 0) {
        const params = { page: 1, per_page: 50 };
        if (applied.search.trim()) params.search = applied.search.trim();
        if (applied.status) params.status = applied.status;
        if (applied.district) params.district = applied.district;
        if (applied.from) params.from = applied.from;
        if (applied.to) params.to = applied.to;

        const firstPage = await api.get("api/admin/orders", { params });
        rows = Array.isArray(firstPage.data) ? [...firstPage.data] : [];
        const totalPages = Math.max(1, Number(firstPage.meta?.total_pages) || 1);
        for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
          const nextPage = await api.get("api/admin/orders", { params: { ...params, page: currentPage } });
          if (Array.isArray(nextPage.data)) rows.push(...nextPage.data);
        }
      }

      if (rows.length === 0) {
        setExportError("There are no orders to export for these filters.");
        return;
      }

      const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const headers = ["Order ID", "Customer", "Phone", "District", "Address", "Total", "Status", "Payment Status", "Placed At", "Products"];
      const csvRows = rows.map((order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : Array.isArray(order.items) ? order.items : [];
        const products = items.map((item) => `${item.title || item.name || "Product"} x ${item.qty ?? item.quantity ?? 1}`).join("; ");
        return [
          formatOrderNumber(order),
          order.name || "Guest",
          order.phone || "",
          order.district || "",
          order.address || order.shipping_address || "",
          order.total ?? order.total_amount ?? "",
          order.status || "",
          order.payment_status || "",
          order.created_at || "",
          products,
        ];
      });
      const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setExportError(err.message || "CSV export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };
  const reset = () => {
    setFilters(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Sales" title="Orders" subtitle="Review, confirm and fulfil customer orders." />

      <div className="orders-export-toolbar">
        <div className="orders-export-copy">
          <strong>{selectedOrders.length ? `${selectedOrders.length} selected` : "Orders CSV"}</strong>
          <span className="muted">{selectedOrders.length ? "Only selected orders will be exported." : "With no selection, exports every order matching the current filters."}</span>
        </div>
        <div className="orders-export-actions">
          {/* Manual order entry: POST /api/admin/orders (the create route had no screen before). */}
          <Link href="/admin/orders/new" className="btn btn-primary btn-sm">
            <FiPlus aria-hidden="true" /> New order
          </Link>
          {selectedOrders.length > 0 && <Button variant="ghost" onClick={() => setSelectedOrders([])}>Clear selection</Button>}
          <Button variant="primary" onClick={downloadCsv} disabled={exporting || (!selectedOrders.length && !visibleOrders.length)}>
            <FiDownload aria-hidden="true" /> {exporting ? "Preparing CSV..." : "Download CSV"}
          </Button>
        </div>
      </div>
      {exportError && <p className="orders-export-error" role="alert">{exportError}</p>}

      <div className="card card-pad toolbar" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
          <Input aria-label="Search orders" placeholder="Search by name, phone or order number" value={filters.search} onChange={set("search")} style={{ paddingLeft: 36 }} />
        </div>
        <Select aria-label="Status" value={filters.status} onChange={set("status")} placeholder="All statuses" options={ORDER_STATUS_OPTIONS} style={{ flex: "0 1 170px" }} />
        <Select aria-label="District" value={filters.district} onChange={set("district")} placeholder="All districts" options={districtOptions} style={{ flex: "0 1 170px" }} />
        <Input aria-label="From date" type="date" value={filters.from} onChange={set("from")} style={{ flex: "0 1 160px" }} />
        <Input aria-label="To date" type="date" value={filters.to} onChange={set("to")} style={{ flex: "0 1 160px" }} />
        <Button variant="ghost" onClick={reset}>Clear</Button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton style={{ height: 360 }} />
      ) : data.orders.length === 0 ? (
        <EmptyState title="No orders match these filters" text="Try clearing the filters or widening the dates." action={<Button variant="outline" onClick={reset}>Clear filters</Button>} />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <th className="orders-select-col">
                  <input ref={selectAllRef} type="checkbox" className="orders-select-input" aria-label="Select all visible orders" checked={allVisibleSelected} onChange={toggleVisibleSelection} disabled={visibleOrders.length === 0} />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Address</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th>Placed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => {
                const st = orderStatusMeta(o.status);
                const rowBadge = assignedBadge(o);
                return (
                  <tr
                    key={o.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => router.push(`/admin/orders/${o.id}`)}
                    onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && router.push(`/admin/orders/${o.id}`)}
                  >
                    <td className="orders-select-col" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="orders-select-input" aria-label={`Select ${formatOrderNumber(o)}`} checked={isSelected(o)} onChange={() => toggleOrderSelection(o)} />
                    </td>
                    <td><Link href={`/admin/orders/${o.id}`} className="num" style={{ fontWeight: 700 }} onClick={(e) => e.stopPropagation()}>{formatOrderNumber(o)}</Link></td>
                    <td>
                      <strong>{o.name || "Guest"}</strong>
                      <span className="muted num" style={{ display: "block", fontSize: "0.84rem" }}>{o.phone || "—"}</span>
                    </td>
                    <td className="muted" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.address}</td>
                    <td className="text-right num">{formatMoney(o.total)}</td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(o.created_at)}</td>
                    <td>
                      <div className="orders-row-actions">
                        <button type="button" className="order-action-button" aria-label={`Edit ${formatOrderNumber(o)}`} title="Edit order" onClick={(event) => { event.stopPropagation(); router.push(`/admin/orders/edit/${o.id}`); }}>
                          <FiEdit2 aria-hidden="true" /> <span>Edit</span>
                        </button>
                        <button type="button" className="order-action-button" aria-label={`Invoice for ${formatOrderNumber(o)}`} title="View invoice" onClick={(event) => { event.stopPropagation(); router.push(`/admin/orders/invoice/${o.id}`); }}>
                          <FiPrinter aria-hidden="true" /> <span>Invoice</span>
                        </button>
                        <button type="button" className="order-action-button order-action-badge" aria-label={`Assign badge to ${o.name || "customer"}`} onClick={(event) => { event.stopPropagation(); openBadgeDialog(o); }}>
                          <FiTag aria-hidden="true" /> <span>Badge</span>
                          {rowBadge && <span className="orders-assigned-badge">{rowBadge}</span>}
                        </button>
                        <button type="button" className="order-action-button order-action-courier" aria-label={`Open courier profile for ${o.name || "customer"}`} onClick={(event) => { event.stopPropagation(); openCourierDialog(o); }}>
                          <FiTruck aria-hidden="true" /> <span>Courier</span>
                        </button>
                        <button
                          type="button"
                          className="order-action-button"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                          aria-label={`Delete ${formatOrderNumber(o)}`}
                          title="Delete order"
                          disabled={deletingId === o.id}
                          onClick={(event) => { event.stopPropagation(); deleteOrder(o); }}
                        >
                          <FiTrash2 aria-hidden="true" /> <span>{deletingId === o.id ? "Deleting…" : "Delete"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={data.meta.current_page || page} totalPages={data.meta.total_pages || 1} onChange={setPage} />
        </>
      )}
    {activeDialog && activeOrder && (
      <div className="orders-modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeActionDialog()}>
        <section className={`orders-modal ${activeDialog === "courier" ? "orders-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="orders-action-modal-title">
          <header className="orders-modal-header">
            <div className="orders-modal-heading">
              <div className="orders-modal-icon">{activeDialog === "badge" ? <FiTag aria-hidden="true" /> : <FiTruck aria-hidden="true" />}</div>
              <div>
                <p className="eyebrow">{activeDialog === "badge" ? "Customer" : "Customer intelligence"}</p>
                <h2 id="orders-action-modal-title">{activeDialog === "badge" ? "Assign Customer Badge" : "Courier delivery profile"}</h2>
                <p className="orders-modal-customer"><strong>{activeOrder.name || "Guest"}</strong><span>{activeOrder.phone || "No phone number"}</span></p>
              </div>
            </div>
            <button type="button" className="orders-modal-close" onClick={closeActionDialog} aria-label="Close dialog"><FiX aria-hidden="true" /></button>
          </header>

          {activeDialog === "badge" ? (
            <>
              <div className="orders-modal-content">
                <div className="orders-modal-field">
                  <label htmlFor="order-customer-badge">Badge</label>
                  <select id="order-customer-badge" className="orders-modal-select" value={badgeDraft} onChange={(event) => setBadgeDraft(event.target.value)}>
                    <option value="">No badge</option>
                    {badgeDraft && !BADGE_OPTIONS.includes(badgeDraft) && <option value={badgeDraft}>{badgeDraft}</option>}
                    {BADGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <p className="orders-modal-note">Saved with PATCH /api/admin/customer-leaderboard/:key/badge. For an account order the badge is stored on the user; for a guest order it is written to that phone number&rsquo;s orders.</p>
              </div>
              <footer className="orders-modal-footer">
                <button type="button" className="orders-modal-button orders-modal-button-secondary" onClick={closeActionDialog}>Cancel</button>
                <button type="button" className="orders-modal-button orders-modal-button-primary" onClick={saveBadge} disabled={badgeSaving}>{badgeSaving ? "Saving…" : "Save Badge"}</button>
              </footer>
            </>
          ) : (
            <>
              <div className="orders-courier-content">
                <section className="orders-courier-overview">
                  <div className="orders-courier-ring"><strong>{courierResult ? "OK" : "—"}</strong><span>API</span></div>
                  <div>
                    <p className="eyebrow">BD Courier lookup</p>
                    <h3>{activeOrder.phone || "No phone number on this order"}</h3>
                    <p>Runs a live courier history check through the configured provider.</p>
                  </div>
                </section>

                {courierError && <p className="notice notice-danger" role="alert">{courierError}</p>}

                {courierResult ? (
                  <section className="orders-courier-breakdown">
                    <div className="orders-courier-breakdown-head">
                      <div><p className="eyebrow">Provider response</p><h3>Courier history</h3></div>
                      <span className="orders-api-status">Received</span>
                    </div>
                    <pre className="num" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.82rem", maxHeight: 260, overflow: "auto" }}>
                      {JSON.stringify(courierResult, null, 2)}
                    </pre>
                  </section>
                ) : (
                  <section className="orders-courier-breakdown">
                    <p>No lookup has been run for this order yet.</p>
                  </section>
                )}
              </div>
              <footer className="orders-modal-footer">
                <span className="muted">Order {formatOrderNumber(activeOrder)}</span>
                <button type="button" className="orders-modal-button orders-modal-button-primary" onClick={runCourierCheck} disabled={courierChecking}>{courierChecking ? "Checking…" : "Run courier check"}</button>
              </footer>
            </>
          )}
        </section>
      </div>
    )}
    </div>
  );
}
