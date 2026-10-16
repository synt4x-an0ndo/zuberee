"use client";

import { useState } from "react";
import { FiRefreshCw, FiSearch, FiUserCheck, FiUsers } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Pagination, Select, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney } from "@/lib/api";
import { BADGE_OPTIONS, badgeKeyFromProfile, badgeLabel, badgePath, badgeTone } from "@/lib/customers";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * GET /api/admin/customers/statistics   (admin JWT)
 *   -> { success, data:{ total_customers, total_orders, total_revenue, average_order_value,
 *                        new_customers, repeat_customers } }
 *
 * GET /api/admin/customer-profiles      (admin JWT)
 *   query: search, has_account (true|false), page, per_page (default 20, max 100)
 *   -> Laravel-style pagination at the TOP level:
 *      { current_page, data:[{ id, name, phone, email, user_id, has_user_account, assigned_badge,
 *                              created_at, updated_at }], last_page, per_page, total, from, to, ... }
 *
 * PATCH /api/admin/customer-leaderboard/:key/badge  (admin JWT)
 *   :key is `user:<id>` or `guest:<phone>`; body { badge: string|null }
 */
const ACCOUNT_FILTERS = [
  { value: "", label: "All customers" },
  { value: "true", label: "Has an account" },
  { value: "false", label: "Guest checkouts only" },
];

export default function CustomersPage() {
  const { toast } = useFeedback();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [account, setAccount] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const stats = useAsync(async () => {
    const body = await api.get("api/admin/customers/statistics");
    return body.data || {};
  }, []);

  const list = useAsync(async () => {
    const params = { page, per_page: 20 };
    if (applied.trim()) params.search = applied.trim();
    if (account) params.has_account = account;
    const body = await api.get("api/admin/customer-profiles", { params });
    return {
      rows: Array.isArray(body.data) ? body.data : [],
      currentPage: body.current_page || page,
      lastPage: body.last_page || 1,
      total: body.total ?? 0,
    };
  }, [applied, account, page]);

  const rows = list.data?.rows || [];
  const s = stats.data || {};

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(search);
  };

  const badgeValue = (row) => {
    const key = badgeKeyFromProfile(row);
    if (key && Object.prototype.hasOwnProperty.call(drafts, key)) return drafts[key];
    return row.assigned_badge || "";
  };

  const saveBadge = async (row) => {
    const key = badgeKeyFromProfile(row);
    if (!key) {
      toast.error("This customer has no phone number or account, so a badge cannot be assigned.");
      return;
    }
    const value = badgeValue(row);
    setSavingKey(key);
    try {
      await api.patch(badgePath(key), { badge: value === "" ? null : value });
      toast.success(`Badge updated for ${row.name || row.phone || "customer"}.`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Sales"
        title="Customers"
        subtitle="Customer profiles, contact details and lifetime value."
        actions={<Button variant="ghost" onClick={() => { stats.reload(); list.reload(); }}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      {stats.error ? <ErrorState message={stats.error} onRetry={stats.reload} /> : !stats.data ? (
        <div className="stat-grid"><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 110 }} /></div>
      ) : (
        <div className="stat-grid stagger">
          <Stat label="Total customers" value={s.total_customers ?? 0} icon={FiUsers} tone="brand" />
          <Stat label="Repeat customers" value={s.repeat_customers ?? 0} hint="2 or more orders" icon={FiUserCheck} tone="success" />
          <Stat label="New customers" value={s.new_customers ?? 0} hint="Exactly 1 order" icon={FiUsers} tone="info" />
          <Stat label="Total revenue" value={formatMoney(s.total_revenue)} hint={`Average order ${formatMoney(s.average_order_value)}`} icon={FiUserCheck} tone="brand" />
        </div>
      )}

      <Card>
        <CardHeader title="Filters" subtitle="Search by name, phone or email." />
        <form onSubmit={submitSearch} className="card-pad" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Search" htmlFor="cust-search" className="grow">
            <div style={{ position: "relative" }}>
              <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
              <Input id="cust-search" placeholder="Name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>
          </Field>
          <Field label="Account" htmlFor="cust-account">
            <Select id="cust-account" value={account} onChange={(e) => { setAccount(e.target.value); setPage(1); }} options={ACCOUNT_FILTERS} />
          </Field>
          <Button type="submit" variant="primary">Apply</Button>
        </form>
      </Card>

      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data ? <Skeleton style={{ height: 360 }} /> : rows.length === 0 ? (
        <EmptyState icon={FiUsers} title="No customers found" text="Customer rows appear once orders are placed against an account or a phone number." />
      ) : (
        <Card>
          <CardHeader title="Customer profiles" subtitle={`${list.data.total} customer${list.data.total === 1 ? "" : "s"}`} />
          <DataTable>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Type</th>
                <th>Joined</th>
                <th style={{ minWidth: 220 }}>Badge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = badgeKeyFromProfile(row);
                const value = badgeValue(row);
                const current = row.assigned_badge || "";
                const dirty = key && value !== current;
                const busy = savingKey === key;
                return (
                  <tr key={row.id ?? row.phone}>
                    <td><strong>{row.name || "Guest"}</strong></td>
                    <td className="muted">
                      {row.phone || "—"}
                      {row.email ? <span style={{ display: "block", fontSize: "0.82rem" }}>{row.email}</span> : null}
                    </td>
                    <td>{row.has_user_account ? <Badge tone="info">Account</Badge> : <Badge tone="neutral">Guest</Badge>}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.created_at)}</td>
                    <td>
                      {key ? (
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <Select aria-label={`Badge for ${row.name || row.phone}`} value={value} onChange={(e) => setDrafts((c) => ({ ...c, [key]: e.target.value }))} options={BADGE_OPTIONS} style={{ minWidth: 150 }} />
                          <Button size="sm" variant={dirty ? "primary" : "outline"} loading={busy} disabled={busy || !dirty} onClick={() => saveBadge(row)}>Save</Button>
                          {!dirty && current && <Badge tone={badgeTone(current)}>{badgeLabel(current)}</Badge>}
                        </div>
                      ) : (
                        <span className="muted">No phone or account — badge unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={list.data.currentPage} totalPages={list.data.lastPage} onChange={setPage} />
        </Card>
      )}
    </div>
  );
}
