"use client";

import { useEffect, useState } from "react";
import {
  FiCheck,
  FiFilter,
  FiInbox,
  FiRefreshCw,
  FiRepeat,
} from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Skeleton } from "@/components/ui";
import { api, formatMoney, imgUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { DISTRICTS } from "@/lib/districts";
import { useAsync } from "@/lib/useAsync";
import { useFeedback } from "@/context/FeedbackContext";

/**
 * GET /api/admin/abandoned-checkouts   (admin JWT)
 *   query: search, status (pending|cancelled|completed|converted), recovered (true|false), page, per_page
 *   -> { success, message, data:[{ id, session_id, user_id, cart_items, name, phone, address,
 *                                  is_recovered, status, converted_order_id, converted_at,
 *                                  created_at, updated_at }],
 *        meta:{ current_page, per_page, total, total_pages, has_more, from, to } }
 *
 * The rows are written by POST /api/abandoned-checkouts, which the storefront fires from the
 * checkout page while a shopper is filling the form.
 *
 * Actions from here:
 *   GET   /api/admin/abandoned-checkouts/:id          - live prices/stock + prefill for the form
 *   PATCH /api/admin/abandoned-checkouts/:id          - { status } from the row dropdown
 *   POST  /api/admin/abandoned-checkouts/:id/convert  - turns the checkout into a real order
 */
/**
 * Every stage an abandoned checkout can move through. Kept in step with
 * backend/lib/checkoutStatuses.js - the two lists must not drift, or the API
 * will reject a value the dropdown offers.
 */
const CHECKOUT_STATUSES = [
  { value: "pending", label: "Pending", tone: "warn" },
  { value: "completed", label: "Completed", tone: "success" },
  { value: "placed", label: "Placed", tone: "info" },
  { value: "cancelled", label: "Cancelled", tone: "danger" },
  { value: "processing", label: "Processing", tone: "info" },
  { value: "returned", label: "Returned", tone: "danger" },
  { value: "first-call-done", label: "1st Call Done", tone: "brand" },
  { value: "second-call-done", label: "2nd Call Done", tone: "brand" },
  { value: "third-call-done", label: "3rd Call Done", tone: "brand" },
  { value: "stock-sold", label: "Stock Sold", tone: "brand" },
  { value: "shipped-to-you", label: "Shipped To You", tone: "info" },
  { value: "received-in-bd", label: "Received In BD", tone: "info" },
  { value: "order-sent-to-china", label: "Order Sent To China", tone: "info" },
  { value: "file-completed", label: "File Completed", tone: "success" },
  { value: "order-confirmed", label: "Order Confirmed", tone: "success" },
  { value: "converted", label: "Converted", tone: "brand" },
];

const EMPTY_FILTERS = { from: "", to: "", status: "", search: "", recovered: "", scope: "actionable" };

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash on delivery" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
];

const DISTRICT_OPTIONS = [{ value: "", label: "Select district" }, ...DISTRICTS];

/**
 * Column furniture.
 *
 * DataTable measures the header cells once, converts the result to percentages
 * and then switches the table to `table-layout: fixed`. Anything measured too
 * narrow stays narrow, so every header declares a minimum and never wraps -
 * otherwise "Conversion" and "Date" break in half and the labels run together.
 *
 * `COL_DIVIDE` draws the hairline that keeps one section from bleeding into the
 * next; the first column is left alone so there is no stray edge on the left.
 */
const COL_DIVIDE = {
  borderLeft: "1px solid var(--line-2)",
  paddingLeft: 12,
  paddingRight: 12,
};

const COL_MIN = {
  name: 150,
  phone: 132,
  address: 170,
  cart: 300,
  status: 158,
  conversion: 120,
  date: 140,
  action: 196,
};

/** Header cell: fixed minimum, a divider, and never wrapped.
 *  The class also changes AlignedTable's cache key, so a layout measured before
 *  these minimums existed can never be reused. */
const head = (key) => ({
  className: "inc-col",
  whiteSpace: "nowrap",
  ...(key === "#" ? {} : COL_DIVIDE),
  ...(key === "#" ? { minWidth: 52 } : { minWidth: COL_MIN[key] }),
});

/** Body cell: the same divider and padding as its header. */
const cell = (key) => (key === "#" ? undefined : COL_DIVIDE);

/**
 * Cart lines with a thumbnail each, matching the reference layout. Falls back to
 * a monogram tile when a product has no image, and folds the cart value in here
 * so dropping the old Value column loses nothing.
 */
function CartItemsCell({ items }) {
  const lines = Array.isArray(items) ? items : [];

  if (lines.length === 0) return <span className="muted">No items</span>;

  const total = lines.reduce(
    (sum, item) =>
      sum + Number(item.unitPrice ?? item.unit_price ?? 0) * Number(item.quantity ?? 1),
    0
  );

  return (
    <div>
      {lines.slice(0, 3).map((item, index) => {
        const src = imgUrl(item.image);
        const title = item.title || item.name || `#${item.productId ?? item.product_id ?? "?"}`;

        return (
          <div
            key={`${item.productId ?? "i"}-${index}`}
            className="row"
            style={{ gap: 8, alignItems: "center", marginBottom: 6 }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                style={{
                  width: 40,
                  height: 40,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  flex: "0 0 auto",
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  flex: "0 0 auto",
                  borderRadius: 8,
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                {String(title).trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.85rem", lineHeight: 1.3 }}>{title}</span>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                &times;{item.quantity ?? 1} &middot;{" "}
                {formatMoney(Number(item.unitPrice ?? item.unit_price ?? 0))}
              </span>
            </span>
          </div>
        );
      })}

      {lines.length > 3 ? (
        <span className="muted" style={{ fontSize: "0.75rem" }}>+{lines.length - 3} more</span>
      ) : null}

      <strong style={{ display: "block", fontSize: "0.85rem", marginTop: 4 }}>
        {formatMoney(total)}
      </strong>
    </div>
  );
}

/**
 * Conversion form. Nothing is written until the admin presses Convert:
 * the panel opens pre-filled from live catalogue data so a stale or
 * out-of-stock line is visible before it becomes an order.
 */
function ConvertModal({ row, onClose, onConverted }) {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const body = await api.get(`api/admin/abandoned-checkouts/${row.id}`);
        if (cancelled) return;

        const data = body.data || {};
        const suggested = data.suggested || {};

        setDetail(data);
        setItems((data.items || []).map((item) => ({ ...item })));
        setForm({
          contactName: suggested.contact_name || "",
          contactPhone: suggested.contact_phone || "",
          contactEmail: suggested.contact_email || "",
          shippingAddress: suggested.shipping_address || "",
          district: suggested.district || "",
          shippingFee: String(suggested.shipping_fee ?? 0),
          advancePayment: "0",
          paymentMethod: "cash",
        });
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || "Could not load this checkout.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row.id]);

  // Primitives only: keeps this effect's dependency list honest.
  const district = form?.district || "";
  const currentFee = form?.shippingFee || "0";

  // Keep the fee in step with the district, using the same rate table the
  // backend applies when it finally writes the order.
  useEffect(() => {
    if (!detail?.shipping_rates) return;

    const rates = detail.shipping_rates;
    let fee = null;

    if (rates.one_shipping_cost !== null && rates.one_shipping_cost !== undefined) {
      fee = Number(rates.one_shipping_cost);
    } else if (district) {
      fee = Number(
        String(district).trim().toLowerCase() === "dhaka" ? rates.inside_dhaka : rates.outside_dhaka
      );
    }

    if (fee !== null && Number.isFinite(fee) && String(fee) !== currentFee) {
      setForm((current) => (current ? { ...current, shippingFee: String(fee) } : current));
    }
  }, [district, detail, currentFee]);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
    0
  );
  const shippingFee = Number(form?.shippingFee || 0);
  const total = subtotal + shippingFee;

  const setQuantity = (index, value) => {
    const parsed = Number(value);
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, quantity: Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0 }
          : item
      )
    );
  };

  const usableItems = items.filter((item) => item.available && Number(item.quantity) > 0);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (usableItems.length === 0) {
      setError("Add at least one available item with a quantity above zero.");
      return;
    }

    setSaving(true);

    try {
      const body = await api.post(`api/admin/abandoned-checkouts/${row.id}/convert`, {
        items: usableItems.map((item) => ({ productId: item.product_id, quantity: Number(item.quantity) })),
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        shippingAddress: form.shippingAddress,
        district: form.district,
        shippingFee,
        advancePayment: Number(form.advancePayment || 0),
        paymentMethod: form.paymentMethod,
      });

      toast.success(body?.message || `Converted to order #${body?.data?.order?.id}.`);
      onConverted();
    } catch (submitError) {
      setError(submitError?.message || "Could not convert this checkout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Convert checkout #${row.id} into an order`}
      width="720px"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="convert-form" variant="primary" loading={saving} disabled={loading || usableItems.length === 0}>
            <FiCheck aria-hidden="true" /> Convert to order
          </Button>
        </>
      }
    >
      {loading ? (
        <Skeleton style={{ height: 220 }} />
      ) : error && !detail ? (
        <ErrorState message={error} onRetry={onClose} />
      ) : (
        <form id="convert-form" onSubmit={submit} className="stack" style={{ gap: "1rem" }}>
          <div>
            <strong style={{ fontSize: "0.92rem" }}>Items</strong>
            <span className="muted" style={{ display: "block", fontSize: "0.8rem", marginBottom: 8 }}>
              Priced from the live catalogue. Set a quantity to 0 to drop a line.
            </span>
            <div className="stack" style={{ gap: 8 }}>
              {items.map((item, index) => (
                <div
                  key={`${item.product_id ?? "row"}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 92px 110px",
                    gap: 10,
                    alignItems: "center",
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    opacity: item.available ? 1 : 0.6,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: "0.88rem" }}>{item.title}</strong>
                    {item.note ? (
                      <span style={{ display: "block", fontSize: "0.76rem", color: "var(--danger, #b3261e)" }}>
                        {item.note}
                      </span>
                    ) : null}
                    {item.available ? (
                      <span className="muted" style={{ display: "block", fontSize: "0.74rem" }}>
                        {item.stock} in stock
                      </span>
                    ) : null}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => setQuantity(index, e.target.value)}
                    aria-label={`Quantity for ${item.title}`}
                    disabled={!item.available}
                  />
                  <span className="num" style={{ fontSize: "0.86rem" }}>
                    {formatMoney(Number(item.unit_price || 0) * Number(item.quantity || 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="Customer name" htmlFor="cv-name" required>
              <Input
                id="cv-name"
                value={form?.contactName || ""}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </Field>
            <Field label="Phone" htmlFor="cv-phone" required hint="01XXXXXXXXX">
              <Input
                id="cv-phone"
                value={form?.contactPhone || ""}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
            </Field>
            <Field
              label="Email"
              htmlFor="cv-email"
              required
              hint={detail?.suggested?.contact_email ? "From the linked account." : "The checkout never stored one."}
            >
              <Input
                id="cv-email"
                type="email"
                value={form?.contactEmail || ""}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </Field>
            <Field label="Payment method" htmlFor="cv-pay">
              <Select
                id="cv-pay"
                value={form?.paymentMethod || "cash"}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                options={PAYMENT_OPTIONS}
              />
            </Field>
          </div>

          <Field label="Shipping address" htmlFor="cv-address" required>
            <Input
              id="cv-address"
              value={form?.shippingAddress || ""}
              onChange={(e) => setForm((f) => ({ ...f, shippingAddress: e.target.value }))}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Field label="District" htmlFor="cv-district">
              <Select
                id="cv-district"
                value={form?.district || ""}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                options={DISTRICT_OPTIONS}
              />
            </Field>
            <Field label="Shipping fee" htmlFor="cv-fee">
              <Input
                id="cv-fee"
                type="number"
                min="0"
                value={form?.shippingFee || "0"}
                onChange={(e) => setForm((f) => ({ ...f, shippingFee: e.target.value }))}
              />
            </Field>
            <Field label="Advance payment" htmlFor="cv-advance">
              <Input
                id="cv-advance"
                type="number"
                min="0"
                value={form?.advancePayment || "0"}
                onChange={(e) => setForm((f) => ({ ...f, advancePayment: e.target.value }))}
              />
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-2, transparent)",
            }}
          >
            <span className="muted" style={{ fontSize: "0.84rem" }}>
              Subtotal {formatMoney(subtotal)} + shipping {formatMoney(shippingFee)}
            </span>
            <strong>{formatMoney(total)}</strong>
          </div>

          {error ? <ErrorState message={error} /> : null}
        </form>
      )}
    </Modal>
  );
}

export default function IncompleteOrdersPage() {
  const { toast } = useFeedback();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [convertRow, setConvertRow] = useState(null);

  /**
   * Search is instant: it applies itself shortly after you stop typing, so the
   * box feels live while the date/status filters stay under the Filter button.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setApplied((prev) =>
        prev.search === filters.search ? prev : { ...prev, search: filters.search }
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [filters.search]);

  const { data, loading, error, reload } = useAsync(async () => {
    const params = { page, per_page: 20 };
    if (applied.search.trim()) params.search = applied.search.trim();
    if (applied.status) params.status = applied.status;
    if (applied.recovered) params.recovered = applied.recovered;
    if (applied.scope) params.scope = applied.scope;
    if (applied.from) params.from = applied.from;
    if (applied.to) params.to = applied.to;
    const body = await api.get("api/admin/abandoned-checkouts", { params });
    return {
      rows: Array.isArray(body.data) ? body.data : [],
      meta: body.meta || {},
    };
  }, [applied, page]);

  const rows = data?.rows || [];
  const meta = data?.meta || {};

  const submit = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const setRowStatus = async (row, status) => {
    if (status === (row.status || "pending")) return;

    setBusyId(row.id);

    try {
      const body = await api.patch(`api/admin/abandoned-checkouts/${row.id}`, { status });
      toast.success(body?.message || "Status updated.");
      reload();
    } catch (patchError) {
      toast.error(patchError?.message || "Could not update this status.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Sales"
        title="Incomplete orders"
        subtitle="Checkouts where a shopper entered details but never placed the order."
        actions={<Button variant="ghost" size="sm" onClick={reload}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      <Card>
        <CardHeader
          title="Filter incomplete orders"
          subtitle="Narrow by date range and status."
          actions={
            <div style={{ minWidth: 260 }}>
              <Input
                id="inc-search"
                type="search"
                aria-label="Search incomplete orders"
                placeholder="Search name, phone or session"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
          }
        />
        <form onSubmit={submit} className="card-pad" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Start Date" htmlFor="inc-from">
            <Input id="inc-from" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </Field>
          <Field label="End Date" htmlFor="inc-to">
            <Input id="inc-to" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </Field>
          <Field label="Status" htmlFor="inc-status">
            {/* Plain <Select>, exactly like the Orders page status filter. */}
            <Select
              id="inc-status"
              aria-label="Filter by status"
              value={filters.status}
              options={CHECKOUT_STATUSES}
              onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
              placeholder="All statuses"
              style={{ width: 230 }}
            />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <Button type="submit" variant="primary"><FiFilter aria-hidden="true" /> Filter</Button>
            <Button type="button" variant="outline" onClick={reset}>Reset</Button>
          </div>
        </form>
      </Card>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 360 }} /> : rows.length === 0 ? (
        <EmptyState
          icon={FiInbox}
          title="Nothing to chase"
          text="No checkout needs follow-up with the current filters. Rows appear here when a shopper enters contact details and stops before placing an order, and leave once they are converted. Switch Show to All to see every checkout, including the ones that became orders."
        />
      ) : (
        <Card>
          <CardHeader title="Incomplete orders" subtitle={`${meta.total ?? rows.length} record${(meta.total ?? rows.length) === 1 ? "" : "s"}`} />
          {/* AlignedTable measures the header row once and then locks the result
              with `table-layout: fixed`. A hot reload keeps that locked layout, so
              the 9th column (Action) would inherit the old 8-column widths and
              collapse. Changing this key remounts the table and re-measures. Bump
              it whenever the column set changes. */}
          <DataTable key="inc-cols-9">
            <thead>
              <tr>
                <th style={head("#")}>#</th>
                <th style={head("name")}>Name</th>
                <th style={head("phone")}>Phone</th>
                <th style={head("address")}>Address</th>
                <th style={head("cart")}>Cart Items</th>
                <th style={head("status")}>Status</th>
                <th style={head("conversion")}>Conversion</th>
                <th style={head("date")}>Date</th>
                <th style={head("action")}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const converted = Boolean(row.converted_order_id);
                const busy = busyId === row.id;

                return (
                  <tr key={row.id}>
                    <td className="num">{row.id}</td>
                    <td style={cell("name")}>
                      <strong>{row.name || "Guest"}</strong>
                      {row.email ? (
                        <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{row.email}</span>
                      ) : null}
                    </td>
                    <td style={{ ...cell("phone"), whiteSpace: "nowrap" }}>
                      {row.phone || <span className="muted">—</span>}
                    </td>
                    <td className="muted" style={{ ...cell("address"), maxWidth: 240 }}>
                      {[row.address, row.district].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td style={{ ...cell("cart"), minWidth: 280, maxWidth: 380 }}>
                      <CartItemsCell items={row.cart_items} />
                    </td>
                    <td style={cell("status")}>
                      {/* Same plain <Select> the Orders page uses - matched to the
                          column so it sits in the cell without stretching it. */}
                      <Select
                        aria-label={`Status for checkout ${row.id}`}
                        value={row.status || "pending"}
                        onChange={(event) => setRowStatus(row, event.target.value)}
                        options={CHECKOUT_STATUSES}
                        disabled={busy}
                        style={{ width: 150 }}
                      />
                    </td>
                    <td style={cell("conversion")}>
                      {row.converted_order_id ? (
                        <>
                          <Badge tone="success">Converted</Badge>
                          <span className="muted" style={{ display: "block", fontSize: "0.75rem", marginTop: 4 }}>
                            Order #{row.converted_order_id}
                          </span>
                        </>
                      ) : (
                        <Badge tone="warn">No order</Badge>
                      )}
                    </td>
                    <td className="muted" style={cell("date")}>
                      {formatDateTime(row.created_at)}
                      {row.converted_at ? (
                        <span style={{ display: "block", fontSize: "0.75rem" }}>
                          Converted {formatDateTime(row.converted_at)}
                        </span>
                      ) : null}
                    </td>
                    <td style={cell("action")}>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setConvertRow(row)}
                          disabled={converted}
                          icon={FiRepeat}
                        >
                          {converted ? "Converted" : "Convert to Order"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={meta.current_page || page} totalPages={meta.total_pages || 1} onChange={setPage} />
        </Card>
      )}

      <div className="notice notice-info" role="note">
        <span>
          A row is opened the moment an item is added to a cart, enriched as the shopper types on the
          checkout form, and closed automatically — linked to the order — as soon as that order is placed.
          This list keeps only checkouts that never became an order and still carry contact details,
          so anything already converted or cart-only drops away on its own. <strong>Convert</strong>
          opens a confirmation panel pre-filled with live prices and stock — an order is only created
          once you confirm it there.
        </span>
      </div>

      {convertRow ? (
        <ConvertModal
          row={convertRow}
          onClose={() => setConvertRow(null)}
          onConverted={() => {
            setConvertRow(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
