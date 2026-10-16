"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FiCalendar,
  FiAward,
  FiChevronRight,
  FiEye,
  FiFilter,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiTag,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, imgUrl } from "@/lib/api";
import { BADGE_OPTIONS, badgeKey, badgeLabel, badgePath, badgeTone } from "@/lib/customers";
import { DISTRICTS } from "@/lib/districts";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * Customer leaderboard — filter/sort toolbar, ranked table, per-row actions.
 *
 * GET /api/admin/customer-leaderboard   (admin JWT)
 *   query: search, sort (total_spent|total_orders|last_order|name), page, per_page (max 100)
 *   -> { success, data:[{ name, phone, email, address, district, total_orders, total_spent,
 *                         last_order_date, last_ordered_products[], badge, assigned_badge }],
 *        pagination:{ current_page, per_page, total, last_page, from, to } }
 *
 * PATCH /api/admin/customer-leaderboard/:key/badge   (admin JWT)
 *   :key is `user:<id>` or `guest:<phone>` (URL encoded); body { badge: string|null }
 *
 * KNOWN LIMITS OF THE RESPONSE (filed as backend items B-18 and B-19):
 *   - formatCustomer() does not echo the group key or the user id, so a row's badge target has to be
 *     rebuilt from the phone number. When one person has both an account entry and a guest entry the
 *     two rows collapse onto the same key: those rows are shown read-only and point at Admin -> Customers
 *     (whose payload does return user_id / has_user_account). A prior version of this page rendered them
 *     with duplicate React keys and could badge the wrong record.
 *   - there is no latest-order id/number, so "Latest order" shows the product lines the response does
 *     return (last_ordered_products) rather than opening the order;
 *   - the route accepts no district and no date-range parameters, so those two controls narrow only the
 *     rows currently loaded on the page. The toolbar says so in plain words.
 */

const PER_PAGE_OPTIONS = [15, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }));

const SORT_ORDER_OPTIONS = [{ value: "total_orders", label: "Most orders" }];
const SORT_SPEND_OPTIONS = [{ value: "total_spent", label: "Highest spending" }];
const SORT_OTHER_OPTIONS = [
  { value: "last_order", label: "Most recent order" },
  { value: "name", label: "Name (A–Z)" },
];

const DEFAULT_DRAFT = {
  search: "",
  district: "",
  from: "",
  to: "",
  sortOrders: "",
  sortSpending: "",
  sortOther: "",
  perPage: "15",
};

const STATUS_TONES = { repeat: "brand", new: "neutral" };

function customerStatus(row) {
  const orders = Number(row.total_orders || 0);
  return orders > 1 ? { key: "repeat", label: "Repeat", tone: STATUS_TONES.repeat } : { key: "new", label: "New", tone: STATUS_TONES.new };
}

function districtLabel(value) {
  if (!value) return "";
  const match = DISTRICTS.find((d) => d.value === String(value).toLowerCase());
  return match ? match.label : String(value);
}

function sortFrom(draft) {
  return draft.sortOrders || draft.sortSpending || draft.sortOther || "total_spent";
}

function linesLastOrder(row) {
  const rows = Array.isArray(row.last_ordered_products) ? row.last_ordered_products : [];
  const items = rows.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  return { count: rows.length, items };
}

/** Products from the most recent order — the only order detail this endpoint returns. */
function LatestOrderBody({ row }) {
  const products = Array.isArray(row.last_ordered_products) ? row.last_ordered_products : [];
  if (!products.length) return <p className="muted" style={{ margin: 0 }}>No product lines were returned for the last order.</p>;
  return (
    <ul className="lb-lines">
      {products.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <div className="lb-line-thumb">
            {item.colorImage ? <Img src={imgUrl(item.colorImage)} alt="" width={38} height={46} sizes="38px" /> : <FiTag aria-hidden="true" />}
          </div>
          <div className="lb-line-copy">
            <strong>{item.title || "Product"}</strong>
            <span className="muted">
              {item.selected_size ? `Size ${item.selected_size} · ` : ""}× {item.qty ?? 1}
              {item.unitPrice !== undefined && item.unitPrice !== null ? ` · ${formatMoney(item.unitPrice)} each` : ""}
            </span>
          </div>
          <span className="num">{item.totalPrice !== undefined && item.totalPrice !== null ? formatMoney(item.totalPrice) : ""}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CustomerLeaderboardPage() {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [applied, setApplied] = useState(DEFAULT_DRAFT);
  const [page, setPage] = useState(1);
  const [savingKey, setSavingKey] = useState(null);
  const [badgeDraft, setBadgeDraft] = useState("");
  const [openRow, setOpenRow] = useState(null);
  const [latestRow, setLatestRow] = useState(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const params = { sort: sortFrom(applied), page, per_page: Number(applied.perPage) || 15 };
    if (applied.search.trim()) params.search = applied.search.trim();
    const body = await api.get("api/admin/customer-leaderboard", { params });
    return {
      rows: Array.isArray(body.data) ? body.data : [],
      pagination: body.pagination || {},
    };
  }, [applied, page]);

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
  const pagination = data?.pagination || {};
  const perPage = Number(applied.perPage) || 15;
  const offset = ((pagination.current_page || page) - 1) * (pagination.per_page || perPage);

  /** How many rows on this page derive the same badge key — more than one means it is ambiguous. */
  const keyCounts = useMemo(() => {
    const counts = new Map();
    for (const row of rows) {
      const key = badgeKey(row);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [rows]);

  const districtOptions = useMemo(() => {
    const seen = new Set(DISTRICTS.map((d) => d.value));
    const found = rows
      .map((row) => String(row.district || "").trim().toLowerCase())
      .filter((value) => value && !seen.has(value))
      .map((value) => ({ value, label: districtLabel(value) }));
    return [...DISTRICTS, ...found].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const clientFiltered = Boolean(applied.district || applied.from || applied.to);

  const visibleRows = useMemo(() => {
    if (!clientFiltered) return rows;
    return rows.filter((row) => {
      if (applied.district && String(row.district || "").trim().toLowerCase() !== applied.district) return false;
      const day = String(row.last_order_date || "").slice(0, 10);
      if (applied.from && (!day || day < applied.from)) return false;
      if (applied.to && (!day || day > applied.to)) return false;
      return true;
    });
  }, [rows, applied.district, applied.from, applied.to, clientFiltered]);

  const totals = useMemo(() => {
    const spent = visibleRows.reduce((sum, row) => sum + Number(row.total_spent || 0), 0);
    const orders = visibleRows.reduce((sum, row) => sum + Number(row.total_orders || 0), 0);
    return { spent, orders };
  }, [visibleRows]);

  const set = (key) => (event) => {
    const value = event.target.value;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      // One server-side sort at a time: choosing one clears the other two.
      if (key === "sortOrders" && value) next.sortSpending = next.sortOther = "";
      if (key === "sortSpending" && value) next.sortOrders = next.sortOther = "";
      if (key === "sortOther" && value) next.sortOrders = next.sortSpending = "";
      return next;
    });
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_DRAFT);
    setApplied(DEFAULT_DRAFT);
    setPage(1);
  };

  const openCustomer = (row) => {
    setBadgeDraft(row.badge || row.assigned_badge || "");
    setOpenRow(row);
  };

  const saveBadge = async (row) => {
    const key = badgeKey(row);
    if (!key) {
      toast.error("This customer has neither an account nor a phone number, so a badge cannot be assigned.");
      return;
    }
    setSavingKey(key);
    try {
      await api.patch(badgePath(key), { badge: badgeDraft === "" ? null : badgeDraft });
      toast.success(`Badge updated for ${row.name || row.phone || "customer"}.`);
      reload();
      setOpenRow(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const openRowKey = openRow ? badgeKey(openRow) : null;
  const openRowShared = Boolean(openRowKey) && (keyCounts.get(openRowKey) || 0) > 1;
  const activeFilters = [applied.search, applied.district, applied.from, applied.to].filter(Boolean).length;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Customers"
        title="Customer leaderboard"
        subtitle="Your highest-value customers, ranked by spend, order count or recency."
        actions={<Button variant="ghost" onClick={reload}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      <Card>
        <CardHeader
          title="Filter & sort customers"
          subtitle={activeFilters ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"} applied` : "Search, narrow and order the list below."}
        />
        <form onSubmit={applyFilters} className="lb-filters card-pad">
          <Field label="Search customer" htmlFor="lb-search" hint="Name, phone or email.">
            <div className="search-input">
              <FiSearch aria-hidden="true" />
              <Input id="lb-search" placeholder="Name, phone, or email..." value={draft.search} onChange={set("search")} />
            </div>
          </Field>

          <Field label="District" htmlFor="lb-district" hint="Narrows the rows loaded on this page.">
            <Select id="lb-district" placeholder="All districts" value={draft.district} onChange={set("district")} options={districtOptions} />
          </Field>

          <Field label="Date range" htmlFor="lb-from" hint="Last order date, inclusive.">
            <div className="lb-range">
              <Input id="lb-from" type="date" aria-label="From date" value={draft.from} onChange={set("from")} />
              <span className="muted" aria-hidden="true">to</span>
              <Input type="date" aria-label="To date" value={draft.to} onChange={set("to")} />
            </div>
          </Field>

          <Field label="Sort by orders" htmlFor="lb-sort-orders">
            <Select id="lb-sort-orders" placeholder="Select…" value={draft.sortOrders} onChange={set("sortOrders")} options={SORT_ORDER_OPTIONS} />
          </Field>

          <Field label="Sort by spending" htmlFor="lb-sort-spending">
            <Select id="lb-sort-spending" placeholder="Select…" value={draft.sortSpending} onChange={set("sortSpending")} options={SORT_SPEND_OPTIONS} />
          </Field>

          <Field label="Sort by date / name" htmlFor="lb-sort-other">
            <Select id="lb-sort-other" placeholder="Select…" value={draft.sortOther} onChange={set("sortOther")} options={SORT_OTHER_OPTIONS} />
          </Field>

          <Field label="Per page" htmlFor="lb-per-page">
            <Select id="lb-per-page" value={draft.perPage} onChange={set("perPage")} options={PER_PAGE_OPTIONS} />
          </Field>

          <div className="lb-filter-actions">
            <Button type="submit" variant="primary"><FiFilter aria-hidden="true" /> Apply filters</Button>
            <Button type="button" variant="outline" onClick={resetFilters}><FiRefreshCw aria-hidden="true" /> Reset</Button>
          </div>
        </form>
        <p className="lb-note muted">
          Search, sort and page size are applied by the API. District and date range are not parameters the
          leaderboard endpoint accepts yet, so those two narrow only the {perPage} rows loaded on this page —
          they are filed with the backend team.
        </p>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton style={{ height: 320 }} />
      ) : (
        <>
          <div className="stat-grid stagger">
            <Stat label="Customers on this page" value={visibleRows.length} icon={FiUsers} tone="brand" />
            <Stat label="Total customers" value={pagination.total ?? visibleRows.length} icon={FiUsers} tone="info" />
            <Stat label="Spend on this page" value={formatMoney(totals.spent)} icon={FiUserCheck} tone="success" />
            <Stat label="Orders on this page" value={totals.orders} icon={FiUserCheck} tone="info" />
          </div>

          <Card>
            <CardHeader
              title="Leaderboard"
              subtitle={
                clientFiltered && visibleRows.length !== rows.length
                  ? `Showing ${visibleRows.length} of the ${rows.length} rows loaded here — ${pagination.total ?? rows.length} customers in total.`
                  : `${pagination.total ?? visibleRows.length} customer${(pagination.total ?? visibleRows.length) === 1 ? "" : "s"} in total`
              }
            />
            {rows.length === 0 ? (
              <div className="card-pad">
                <EmptyState
                  icon={FiUsers}
                  title={applied.search ? "No customers match" : "No customers yet"}
                  text={applied.search ? "Try a different search term." : "Customers appear here once orders are placed."}
                />
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="card-pad">
                <EmptyState
                  icon={FiFilter}
                  title="No rows on this page match the district / date filter"
                  text="Those filters only see the rows already loaded. Reset them, or move to another page."
                  action={<Button variant="ghost" onClick={resetFilters}>Reset filters</Button>}
                />
              </div>
            ) : (
              <>
                <DataTable>
                  <thead>
                    <tr>
                      <th style={{ width: 76 }}>Rank</th>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Statistics</th>
                      <th className="text-right">Total spent</th>
                      <th>Status</th>
                      <th className="text-right" style={{ width: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => {
                      const key = badgeKey(row);
                      // A key can only repeat when an account entry and a guest entry share one phone
                      // number; the row position keeps the React key unique in every case.
                      const shared = Boolean(key) && (keyCounts.get(key) || 0) > 1;
                      const serverIndex = rows.indexOf(row);
                      const rank = offset + (serverIndex < 0 ? index : serverIndex) + 1;
                      const badge = row.badge || row.assigned_badge || "";
                      const status = customerStatus(row);
                      const last = linesLastOrder(row);
                      const avg = Number(row.total_orders || 0) > 0 ? Number(row.total_spent || 0) / Number(row.total_orders || 0) : null;
                      const thumbs = (Array.isArray(row.last_ordered_products) ? row.last_ordered_products : [])
                        .map((item) => imgUrl(item.colorImage))
                        .filter(Boolean)
                        .slice(0, 3);
                      return (
                        <tr key={`${key || "row"}-${index}`}>
                          <td>
                            <span className={`lb-rank${rank <= 3 ? ` lb-rank-${rank}` : ""}`}>
                              {rank <= 3 ? <FiAward aria-hidden="true" /> : String(rank).padStart(2, "0")}
                            </span>
                          </td>
                          <td>
                            <div className="lb-cust">
                              <strong>{row.name || "Guest"}</strong>
                              <span className="muted lb-meta"><FiCalendar aria-hidden="true" /> {row.last_order_date ? formatDateTime(row.last_order_date) : "No orders"}</span>
                              {thumbs.length > 0 && (
                                <span className="lb-thumbs" aria-label={`${thumbs.length} product image${thumbs.length === 1 ? "" : "s"} from the last order`}>
                                  {thumbs.map((src, i) => (
                                    <span key={`${src}-${i}`} className="lb-thumb"><Img src={src} alt="" width={26} height={32} sizes="26px" /></span>
                                  ))}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="lb-contact">
                              {row.phone ? (
                                <a className="lb-meta" href={`tel:${row.phone}`}><FiPhone aria-hidden="true" /> {row.phone}</a>
                              ) : (
                                <span className="muted lb-meta"><FiPhone aria-hidden="true" /> No phone on file</span>
                              )}
                              {row.email && <a className="lb-meta muted" href={`mailto:${row.email}`}><FiMail aria-hidden="true" /> {row.email}</a>}
                              <span className="lb-meta muted"><FiMapPin aria-hidden="true" /> {districtLabel(row.district) || "No district"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="lb-stats">
                              <Badge tone="brand">{row.total_orders ?? 0} Orders</Badge>
                              <button type="button" className="lb-link" onClick={() => setLatestRow(row)}>
                                View latest order <FiChevronRight aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                          <td className="text-right">
                            <span className="num lb-spent">{formatMoney(row.total_spent)}</span>
                            <span className="muted lb-meta">
                              <FiTag aria-hidden="true" /> {last.count} product{last.count === 1 ? "" : "s"} in last order
                            </span>
                            {avg !== null && <span className="muted lb-meta">Avg {formatMoney(avg)} / order</span>}
                          </td>
                          <td>
                            <div className="lb-status">
                              <Badge tone={status.tone}>{status.label}</Badge>
                              {badge && <Badge tone={badgeTone(badge)}>{badgeLabel(badge)}</Badge>}
                            </div>
                          </td>
                          <td>
                            <div className="table actions lb-actions">
                              <button type="button" className="icon-btn" onClick={() => openCustomer(row)} aria-label={`View ${row.name || row.phone || "customer"}`}>
                                <FiEye aria-hidden="true" />
                              </button>
                              {row.phone && (
                                <a className="icon-btn" href={`tel:${row.phone}`} aria-label={`Call ${row.name || row.phone}`}>
                                  <FiPhone aria-hidden="true" />
                                </a>
                              )}
                              {row.phone && (
                                <a className="icon-btn" href={`https://wa.me/${row.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${row.name || row.phone}`}>
                                  <FiMessageCircle aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
                <Pagination page={pagination.current_page || page} totalPages={pagination.last_page || 1} onChange={setPage} />
              </>
            )}
          </Card>
        </>
      )}

      {/* Latest-order breakdown (the only order detail the endpoint returns) */}
      <Modal open={Boolean(latestRow)} onClose={() => setLatestRow(null)} title={latestRow ? `Latest order — ${latestRow.name || latestRow.phone || "customer"}` : "Latest order"}>
        {latestRow && (
          <div className="stack" style={{ gap: 12 }}>
            <p className="muted" style={{ margin: 0 }}>{latestRow.last_order_date ? formatDateTime(latestRow.last_order_date) : ""}</p>
            <LatestOrderBody row={latestRow} />
          </div>
        )}
      </Modal>

      {/* Customer details + badge editor */}
      <Modal
        open={Boolean(openRow)}
        onClose={() => setOpenRow(null)}
        title={openRow ? openRow.name || openRow.phone || "Customer" : "Customer"}
        footer={openRow && !openRowShared && openRowKey ? (
          <Button variant="primary" loading={savingKey === openRowKey} disabled={savingKey === openRowKey} onClick={() => saveBadge(openRow)}>
            Save badge
          </Button>
        ) : null}
      >
        {openRow && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="lb-details">
              <p><span className="muted">Phone</span><strong>{openRow.phone || "—"}</strong></p>
              <p><span className="muted">Email</span><strong>{openRow.email || "—"}</strong></p>
              <p><span className="muted">District</span><strong>{districtLabel(openRow.district) || "—"}</strong></p>
              <p><span className="muted">Address</span><strong>{openRow.address || "—"}</strong></p>
              <p><span className="muted">Orders</span><strong>{openRow.total_orders ?? 0}</strong></p>
              <p><span className="muted">Total spent</span><strong>{formatMoney(openRow.total_spent)}</strong></p>
              <p><span className="muted">Last order</span><strong>{openRow.last_order_date ? formatDateTime(openRow.last_order_date) : "—"}</strong></p>
            </div>

            <div>
              <p className="field-label" style={{ marginBottom: 8 }}>Latest order</p>
              <LatestOrderBody row={openRow} />
            </div>

            {openRowShared ? (
              <div className="lb-warn">
                <strong>Badge locked for this row.</strong> This phone number has both a customer-account entry
                and a guest entry, and the leaderboard response does not say which record a row belongs to, so
                a save from here could hit the wrong customer. Set it from{" "}
                <Link href="/admin/customers" className="link-arrow">Admin → Customers</Link>, which returns the account id.
              </div>
            ) : openRowKey ? (
              <Field label="Badge" htmlFor="lb-badge" hint="Saved with PATCH /api/admin/customer-leaderboard/:key/badge.">
                <Select id="lb-badge" value={badgeDraft} onChange={(e) => setBadgeDraft(e.target.value)} options={BADGE_OPTIONS} />
              </Field>
            ) : (
              <div className="lb-warn">
                <strong>No badge target.</strong> This row has no phone number and no echoed account id, so it
                cannot be addressed from the leaderboard. Use{" "}
                <Link href="/admin/customers" className="link-arrow">Admin → Customers</Link> instead.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
