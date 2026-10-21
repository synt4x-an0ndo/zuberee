"use client";

import { FiActivity, FiCalendar, FiCreditCard, FiRefreshCw, FiShield } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Badge, Button, Card, CardHeader, ErrorState, Skeleton, Stat } from "@/components/ui";
import { api, formatMoney } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

/**
 * GET /api/admin/fraud-checker/plan   (admin JWT)
 *   -> { status, data: { plan: { has_subscription, plan_id, plan_name, plan_type, is_free,
 *                                 status, next_due_date, expires_at, days_remaining, frequency,
 *                                 price, api_calls, paid_calls, call_limit, paid_limit,
 *                                 remaining_free_calls, remaining_paid_calls },
 *                        meta: { cached, checked_at } } }
 *
 * The backend reads these figures from the stored FraudCheckerSettings row, so a plan that has
 * never been provisioned shows zeroed allowances instead of a live billing lookup.
 */
const STATUS_TONE = { active: "success", inactive: "neutral", expired: "danger", cancelled: "warn" };

export default function CourierPlanPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const body = await api.get("api/admin/fraud-checker/plan");
    return { plan: body.data?.plan || {}, meta: body.data?.meta || {} };
  }, []);

  const plan = data?.plan || {};
  const meta = data?.meta || {};

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="BD Courier account"
        title="Courier Plan & Usage"
        subtitle="Subscription, renewal date and available courier checker calls."
        actions={<Button variant="ghost" onClick={reload}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 320 }} /> : (
        <>
          <Card>
            <div className="between" style={{ gap: 20, flexWrap: "wrap" }}>
              <div>
                <p className="eyebrow">Current subscription</p>
                <h2 style={{ marginTop: 6 }}>{plan.plan_name || (plan.has_subscription ? "Subscribed" : "No plan")}</h2>
                <p className="muted">
                  {plan.has_subscription
                    ? `${plan.plan_type || "plan"}${plan.frequency ? ` · billed ${plan.frequency}` : ""}`
                    : "No active subscription is recorded for this courier account."}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: "2rem" }} className="num">{plan.days_remaining ?? 0}</strong>
                <p className="muted">days remaining</p>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Badge tone={STATUS_TONE[plan.status] || "neutral"}>{plan.status || "unknown"}</Badge>
              {plan.is_free ? <Badge tone="info">Free tier</Badge> : <Badge tone="brand">Paid</Badge>}
              {plan.expires_at ? <Badge tone="neutral">Expires {plan.expires_at}</Badge> : null}
            </div>
          </Card>

          <div className="stat-grid stagger">
            <Stat label="Next due date" value={plan.next_due_date || "—"} hint="Subscription renewal" icon={FiCalendar} tone="info" />
            <Stat label="Plan price" value={plan.price === null || plan.price === undefined ? "—" : formatMoney(plan.price)} hint={plan.frequency || "Billing frequency"} icon={FiCreditCard} tone="brand" />
            <Stat label="Total API calls" value={(plan.api_calls ?? 0) + (plan.paid_calls ?? 0)} hint="Free and paid calls used" icon={FiActivity} tone="success" />
          </div>

          <Card>
            <CardHeader title="Remaining usage" subtitle="Call allowance recorded against the courier settings." />
            <div className="grid-2">
              <UsageCard label="Free calls" remaining={plan.remaining_free_calls ?? 0} allowance={plan.call_limit ?? 0} used={plan.api_calls ?? 0} />
              <UsageCard label="Paid calls" remaining={plan.remaining_paid_calls ?? 0} allowance={plan.paid_limit ?? 0} used={plan.paid_calls ?? 0} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Plan details"
              subtitle={meta.checked_at ? `Snapshot taken ${meta.checked_at}` : undefined}
              actions={meta.cached ? <Badge tone="info">Cached</Badge> : null}
            />
            <div className="form-grid">
              <Detail label="Plan type" value={plan.plan_type || "—"} />
              <Detail label="Subscription status" value={plan.status || "—"} />
              <Detail label="Plan ID" value={plan.plan_id ?? "—"} />
              <Detail label="Renewal frequency" value={plan.frequency || "—"} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function UsageCard({ label, remaining, allowance, used }) {
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  return (
    <div className="card card-pad" style={{ border: "1px solid var(--line)", boxShadow: "none" }}>
      <div className="between">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><FiShield aria-hidden="true" /><strong>{label}</strong></div>
        <span className="badge badge-brand">Allowance {allowance}</span>
      </div>
      <p style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: 18 }} className="num">{remaining}</p>
      <span className="muted">remaining</span>
      <div style={{ height: 6, borderRadius: 99, background: "var(--brand-tint)", marginTop: 14, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand)" }} />
      </div>
      <span className="muted" style={{ fontSize: "0.82rem", display: "block", marginTop: 8 }}>{used} of {allowance} used</span>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="between" style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
