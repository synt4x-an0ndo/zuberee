"use client";

import { useEffect, useState } from "react";
import { api, formatTk } from "@/lib/api";
import PageGate from "@/components/admin/PageGate";
import "@/styles/css/856b07e4fdaff3d2.css";
import Loader from "@/components/Loader";

/**
 * Courier plan & usage (/dashboard/fraud-checker/plan)
 *  - GET api/fraud-checker/plan
 *    -> {data:{subscription:{plan_type,status,plan_id,renewal_frequency,
 *              next_due_date,days_remaining,price}, usage:{total_calls,
 *              allowance,remaining,...}}}
 */
function FraudPlan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/fraud-checker/plan");
        setData(r?.data || r);
      } catch (e) {
        setError(e.message || "Couldn’t load your courier plan");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="text-center py-5">
        <span className="spinner-border text-primary me-2" />
        <div className="text-muted mt-2">Loading courier plan</div>
        <small className="text-muted">
          Retrieving subscription and usage details...
        </small>
      </div>
    );
  if (error)
    return <div className="alert alert-danger">{error}</div>;

  const sub = data?.subscription || data?.plan || {};
  const usage = data?.usage || data;
  const pct = usage?.total_calls
    ? Math.round(((usage.allowance - usage.remaining) / usage.total_calls) * 100)
    : 0;

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-1">Courier Plan &amp; Usage</h4>
      <p className="text-muted">
        Monitor your subscription, renewal date, and available courier checker calls.
      </p>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">BD Courier account</small>
              <h5 className="fw-bold mb-2">
                {sub.plan_type || "No active subscription"}
              </h5>
              <div className="d-flex justify-content-between small mb-1">
                <span>Current subscription</span>
                <b>{sub.days_remaining ?? "—"} days remaining</b>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>Next due date</span>
                <b>{sub.next_due_date ? String(sub.next_due_date).slice(0, 10) : "—"}</b>
              </div>
              <div className="d-flex justify-content-between small">
                <span>Plan price</span>
                <b>{sub.price != null ? `${formatTk(sub.price)}৳` : "—"}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Allowance</small>
              <h5 className="fw-bold">
                {usage.remaining ?? "—"}{" "}
                <span className="fs-6 text-muted">remaining</span>
              </h5>
              <div className="progress mb-2" style={{ height: 8 }}>
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>Total API calls</span>
                <b>{usage.total_calls ?? "—"}</b>
              </div>
              <div className="d-flex justify-content-between small">
                <span>Call allowance</span>
                <b>{usage.allowance ?? "—"}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Subscription information</small>
              <h6 className="fw-bold mt-1">Plan details</h6>
              <div className="d-flex justify-content-between small mb-1">
                <span>Plan type</span>
                <b>{sub.plan_type || "—"}</b>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>Subscription status</span>
                <b>{sub.status ? String(sub.status) : "Not subscribed"}</b>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>Plan ID</span>
                <b>{sub.plan_id ?? "—"}</b>
              </div>
              <div className="d-flex justify-content-between small">
                <span>Renewal frequency</span>
                <b>{sub.renewal_frequency || "—"}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FraudPlanPage() {
  return (
    <PageGate permission="view settings">
      <FraudPlan />
    </PageGate>
  );
}
