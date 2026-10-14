"use client";

import { FiActivity, FiCalendar, FiCreditCard, FiRefreshCw, FiShield } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";

export default function CourierPlanPage() {
  const { toast } = useFeedback();
  const refresh = () => toast.info("Courier plan data will refresh when the backend billing API is connected.");

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="BD Courier account"
        title="Courier Plan & Usage"
        subtitle="Monitor your subscription, renewal date and available courier checker calls."
        actions={<Button variant="ghost" onClick={refresh}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      <Card>
        <div className="between" style={{ gap: 20, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow">Current subscription</p>
            <h2 style={{ marginTop: 6 }}>Basic</h2>
            <p className="muted">Backend plan details will appear here once connected.</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong style={{ fontSize: "2rem" }}>—</strong>
            <p className="muted">days remaining</p>
          </div>
        </div>
      </Card>

      <div className="stat-grid stagger">
        <Stat label="Next due date" value="—" hint="Subscription renewal" icon={FiCalendar} tone="info" />
        <Stat label="Plan price" value="—" hint="Billing frequency" icon={FiCreditCard} tone="brand" />
        <Stat label="Total API calls" value="—" hint="Paid and free calls" icon={FiActivity} tone="success" />
      </div>

      <Card>
        <CardHeader title="Remaining usage" subtitle="Call allowance from the connected courier provider." />
        <div className="grid-2">
          <UsageCard label="Free calls" remaining="—" allowance="—" />
          <UsageCard label="Paid calls" remaining="—" allowance="—" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Plan details" subtitle="Subscription information supplied by the backend billing service." />
        <div className="form-grid">
          <Detail label="Plan type" value="—" />
          <Detail label="Subscription status" value="Pending integration" />
          <Detail label="Plan ID" value="—" />
          <Detail label="Renewal frequency" value="—" />
        </div>
      </Card>
    </div>
  );
}

function UsageCard({ label, remaining, allowance }) {
  return (
    <div className="card card-pad" style={{ border: "1px solid var(--line)", boxShadow: "none" }}>
      <div className="between">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><FiShield aria-hidden="true" /><strong>{label}</strong></div>
        <span className="badge badge-brand">Allowance {allowance}</span>
      </div>
      <p style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: 18 }}>{remaining}</p>
      <span className="muted">remaining</span>
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
