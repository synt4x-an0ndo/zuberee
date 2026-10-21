"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FiArrowDownRight,
  FiArrowUpRight,
  FiCalendar,
  FiAward,
  FiChevronRight,
  FiDollarSign,
  FiEye,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiStar,
  FiTag,
  FiTrendingUp,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Skeleton } from "@/components/ui";
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
 *   query: search, district, date_from, date_to, order_count_sort, total_spent_sort,
 *          page, per_page (max 100)
 *   -> { success, data:[{ name, phone, email, address, district, total_orders, total_spent,
 *                         last_order_date, last_ordered_products[], badge, assigned_badge }],
 *        summary:{ total_customers, total_orders, total_revenue, average_order_value,
 *                  new_customers, repeat_customers, repeat_rate, changes },
 *        districts:[], pagination:{ current_page, per_page, total, last_page, from, to } }
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
 *     return (last_ordered_products) rather than opening the order.
 */

const PER_PAGE_OPTIONS = [15, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }));

const ORDER_SORT_OPTIONS = [
  { value: "desc", label: "📈 Most Orders First" },
  { value: "asc", label: "📉 Least Orders First" },
];
const SPEND_SORT_OPTIONS = [
  { value: "desc", label: "💰 Highest Spent First" },
  { value: "asc", label: "💸 Lowest Spent First" },
];

const DEFAULT_FILTERS = {
  search: "",
  district: "",
  from: "",
  to: "",
  orderSort: "desc",
  spendSort: "desc",
  perPage: "15",
};

const STATUS_TONES = { repeat: "brand", new: "info" };

function customerStatus(row) {
  const orders = Number(row.total_orders || 0);
  return orders > 1 ? { key: "repeat", label: "Repeat", tone: STATUS_TONES.repeat } : { key: "new", label: "New", tone: STATUS_TONES.new };
}

function districtLabel(value) {
  if (!value) return "";
  const match = DISTRICTS.find((d) => d.value === String(value).toLowerCase());
  return match ? match.label : String(value);
}

function customerInitial(row) {
  const source = String(row.name || row.phone || "G").trim();
  return (source.charAt(0) || "G").toUpperCase();
}

function ChangeBadge({ value, label = "vs last month" }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className="lb-change is-empty">No last-month data</span>;
  }

  const numeric = Number(value);
  const increasing = numeric >= 0;
  const Arrow = increasing ? FiArrowUpRight : FiArrowDownRight;
  return (
    <span className={`lb-change ${increasing ? "is-up" : "is-down"}`}>
      <Arrow aria-hidden="true" />
      {Math.abs(numeric).toFixed(1)}%
      <small>{label}</small>
    </span>
  );
}

function OverviewStat({ label, value, icon: Icon, tone = "brand", change, comparisonLabel }) {
  return (
    <div className={`stat lb-overview-stat lb-tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="stat-value">{value}</span>
      <ChangeBadge value={change} label={comparisonLabel} />
    </div>
  );
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
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [savingKey, setSavingKey] = useState(null);
  const [badgeDraft, setBadgeDraft] = useState("");
  const [openRow, setOpenRow] = useState(null);
  const [latestRow, setLatestRow] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.search === searchInput ? current : { ...current, search: searchInput }
      );
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, loading, error, reload } = useAsync(async () => {
    const params = {
      page,
      per_page: Number(filters.perPage) || 15,
      order_count_sort: filters.orderSort,
      total_spent_sort: filters.spendSort,
    };
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.district) params.district = filters.district;
    if (filters.from) params.date_from = filters.from;
    if (filters.to) params.date_to = filters.to;
    const body = await api.get("api/admin/customer-leaderboard", { params });
    return {
      rows: Array.isArray(body.data) ? body.data : [],
      pagination: body.pagination || {},
      summary: body.summary || {},
      districts: Array.isArray(body.districts) ? body.districts : [],
    };
  }, [filters, page]);

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};
  const changes = summary.changes || {};
  const perPage = Number(filters.perPage) || 15;
  const offset = ((pagination.current_page || page) - 1) * (pagination.per_page || perPage);
  const repeatRate = Number(
    summary.repeat_rate ??
      (summary.total_customers
        ? (Number(summary.repeat_customers || 0) / Number(summary.total_customers)) * 100
        : 0)
  );

  /** How many rows on this page derive the same badge key — more than one means it is ambiguous. */
  const keyCounts = useMemo(() => {
    const counts = new Map();
    for (const row of rows) {
      const key = badgeKey(row);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [rows]);

  const districtOptions = (() => {
    const seen = new Set(DISTRICTS.map((d) => d.value));
    const foundValues = [
      ...(Array.isArray(data?.districts) ? data.districts : []),
      ...rows.map((row) => row.district),
    ];
    const found = Array.from(
      new Set(foundValues.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))
    )
      .filter((value) => !seen.has(value))
      .map((value) => ({ value, label: districtLabel(value) }));
    return [...DISTRICTS, ...found].sort((a, b) => a.label.localeCompare(b.label));
  })();

  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
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
  const activeFilters = [filters.search, filters.district, filters.from, filters.to].filter(Boolean).length;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Customers"
        title="Customer Leaderboard"
        subtitle="Your highest-value customers, ranked by orders and lifetime spending."
        actions={<Button variant="ghost" onClick={reload}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      {!data && loading ? (
        <>
          <div className="lb-overview-grid" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} style={{ height: 126 }} />)}
          </div>
          <Skeleton style={{ height: 112 }} />
        </>
      ) : data ? (
        <>
          <div className="lb-overview-grid stagger">
            <OverviewStat label="Total Customers" value={summary.total_customers ?? pagination.total ?? rows.length} icon={FiUsers} tone="brand" change={changes.total_customers} comparisonLabel={summary.comparison_label} />
            <OverviewStat label="Total Orders" value={summary.total_orders ?? 0} icon={FiShoppingBag} tone="success" change={changes.total_orders} comparisonLabel={summary.comparison_label} />
            <OverviewStat label="Total Revenue" value={formatMoney(summary.total_revenue)} icon={FiDollarSign} tone="info" change={changes.total_revenue} comparisonLabel={summary.comparison_label} />
            <OverviewStat label="Avg Order Value" value={formatMoney(summary.average_order_value)} icon={FiTrendingUp} tone="warn" change={changes.average_order_value} comparisonLabel={summary.comparison_label} />
            <OverviewStat label="New Customers" value={summary.new_customers ?? 0} icon={FiUserPlus} tone="info" change={changes.new_customers} comparisonLabel={summary.comparison_label} />
            <OverviewStat label="Repeat Customers" value={summary.repeat_customers ?? 0} icon={FiUserCheck} tone="brand" change={changes.repeat_customers} comparisonLabel={summary.comparison_label} />
          </div>

          <Card className="lb-insights">
            <div className="card-pad lb-insights-inner">
              <div className="lb-insights-top">
                <div className="lb-insights-title">
                  <span className="lb-insights-icon"><FiStar aria-hidden="true" /></span>
                  <div>
                    <h2>Customer Insights</h2>
                    <p>Your business performance overview</p>
                  </div>
                </div>
                <div className="lb-repeat-rate">
                  <span>Repeat Rate</span>
                  <strong>{repeatRate.toFixed(1)}%</strong>
                </div>
              </div>
              <div
                className="lb-progress"
                role="progressbar"
                aria-label="Customer repeat rate"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, repeatRate))}
              >
                <span style={{ width: `${Math.min(100, Math.max(0, repeatRate))}%` }} />
              </div>
            </div>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader
          title="Filter & Sort Customers"
          subtitle={activeFilters ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"} applied` : "Search, narrow and order the ranked list."}
          actions={activeFilters ? <Button type="button" variant="ghost" onClick={resetFilters}><FiRefreshCw aria-hidden="true" /> Reset</Button> : null}
        />
        <div className="lb-filters card-pad">
          <Field label="Search Customer" htmlFor="lb-search" hint="Name, phone or email.">
            <div className="search-input">
              <FiSearch aria-hidden="true" />
              <Input id="lb-search" placeholder="Name, phone, or email..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            </div>
          </Field>

          <Field label="District" htmlFor="lb-district">
            <Select id="lb-district" placeholder="All Districts" value={filters.district} onChange={setFilter("district")} options={districtOptions} />
          </Field>

          <Field label="Sort by Orders" htmlFor="lb-sort-orders">
            <Select id="lb-sort-orders" value={filters.orderSort} onChange={setFilter("orderSort")} options={ORDER_SORT_OPTIONS} />
          </Field>

          <Field label="Sort by Spending" htmlFor="lb-sort-spending">
            <Select id="lb-sort-spending" value={filters.spendSort} onChange={setFilter("spendSort")} options={SPEND_SORT_OPTIONS} />
          </Field>

          <Field label="Date Range" htmlFor="lb-from" hint="Last order date, inclusive." className="lb-filter-date">
            <div className="lb-range">
              <Input id="lb-from" type="date" aria-label="Start date" value={filters.from} onChange={setFilter("from")} />
              <span className="muted" aria-hidden="true">to</span>
              <Input type="date" aria-label="End date" value={filters.to} onChange={setFilter("to")} />
            </div>
          </Field>

          <Field label="Results per page" htmlFor="lb-per-page">
            <Select id="lb-per-page" value={filters.perPage} onChange={setFilter("perPage")} options={PER_PAGE_OPTIONS} />
          </Field>
        </div>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton style={{ height: 320 }} />
      ) : (
        <>
          <Card>
            {rows.length === 0 ? (
              <div className="card-pad">
                <EmptyState
                  icon={FiUsers}
                  title={activeFilters ? "No customers match" : "No customers yet"}
                  text={activeFilters ? "Try a different search or reset the filters." : "Customers appear here once orders are placed."}
                  action={activeFilters ? <Button variant="ghost" onClick={resetFilters}>Reset filters</Button> : null}
                />
              </div>
            ) : (
              <>
                <DataTable className="lb-table-wrap">
                  <thead>
                    <tr>
                      <th style={{ width: 76 }}>Rank</th>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Statistics</th>
                      <th className="text-right">Total Spent</th>
                      <th>Status</th>
                      <th className="text-right" style={{ width: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const key = badgeKey(row);
                      // A key can only repeat when an account entry and a guest entry share one phone
                      // number; the row position keeps the React key unique in every case.
                      const rank = offset + index + 1;
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
                              <div className="lb-customer-main">
                                <span className="lb-avatar" aria-hidden="true">{customerInitial(row)}</span>
                                <div className="lb-customer-copy">
                                  <strong>{row.name || "Guest"}</strong>
                                  <span className="muted lb-meta"><FiCalendar aria-hidden="true" /> {row.last_order_date ? formatDateTime(row.last_order_date) : "No orders"}</span>
                                </div>
                              </div>
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
                              <Badge tone="info"><FiShoppingBag aria-hidden="true" /> {row.total_orders ?? 0} Orders</Badge>
                              <button type="button" className="lb-link" onClick={() => setLatestRow(row)}>
                                View Latest Order <FiChevronRight aria-hidden="true" />
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
                                <a className="icon-btn lb-whatsapp" href={`https://wa.me/${row.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${row.name || row.phone}`}>
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
