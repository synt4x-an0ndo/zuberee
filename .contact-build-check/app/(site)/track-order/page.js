"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiHome,
  FiLock,
  FiMapPin,
  FiNavigation,
  FiPackage,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiShoppingBag,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Skeleton, cx } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { api, formatMoney, isValidBdPhone, normalizePhone } from "@/lib/api";
import { formatDateTime, formatOrderNumber, orderStatusMeta, paymentStatusMeta } from "@/lib/format";
import { normalizeOrders } from "@/lib/order";
import { buildTrackingModel } from "@/lib/orderTracking";

/**
 * Public courier-style order tracking.
 *
 * Current backend data source (no new endpoint required):
 *   GET /api/orders/:id -> order status/payment, totals, items,
 *   shipping district/address, created_at and updated_at.
 *
 * The timeline is built by lib/orderTracking.js. When the backend adds the
 * courier/shipment fields documented in COURIER_TRACKING_API_CONTRACT.md,
 * this page automatically shows the courier name, tracking ID, ETA,
 * provider tracking link and real scan events.
 *
 * Privacy follows the previous page: status and a limited summary can be
 * viewed by order number, while address, item and tracking-ID details are
 * only revealed to the signed-in order owner or after the guest phone matches.
 */

const STEP_ICONS = {
  receipt: FiClipboard,
  check: FiCheckCircle,
  package: FiPackage,
  truck: FiTruck,
  navigation: FiNavigation,
  home: FiHome,
  clock: FiClock,
  alert: FiAlertCircle,
  cancelled: FiXCircle,
};

function parseOrderId(value) {
  const id = Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function titleCasePlace(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function humanizeStatus(value) {
  return titleCasePlace(value);
}

function statusHeroIcon(tracking) {
  if (tracking?.isCancelled) return FiXCircle;
  if (tracking?.isDelivered) return FiCheckCircle;
  return STEP_ICONS[tracking?.icon] || FiTruck;
}

function Stepper({ steps, progressPercent, isCancelled }) {
  return (
    <ol
      className={cx("tracking-stepper", isCancelled && "is-cancelled")}
      style={{ "--tracking-progress": `${progressPercent}%` }}
      aria-label="Shipment progress"
    >
      {steps.map((step) => {
        const Icon = step.state === "complete" ? FiCheck : step.state === "cancelled" ? FiXCircle : STEP_ICONS[step.icon] || FiPackage;
        return (
          <li
            key={step.key}
            className={cx("tracking-step", `is-${step.state}`)}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <span className="tracking-step-node" aria-hidden="true">
              <Icon />
            </span>
            <span className="tracking-step-label">{step.shortLabel}</span>
            <span className="tracking-step-time">
              {step.occurredAt
                ? formatDateTime(step.occurredAt)
                : step.state === "complete"
                  ? "Completed"
                  : step.state === "current"
                    ? "Current"
                    : step.state === "cancelled"
                      ? "Not reached"
                      : "Upcoming"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function eventIcon(event) {
  const key = `${event.statusKey || ""} ${String(event.title || "").toLowerCase()}`;
  if (key.includes("cancel")) return FiXCircle;
  if (key.includes("deliver") && !key.includes("outfor")) return FiCheckCircle;
  if (key.includes("outfor") || key.includes("out for")) return FiNavigation;
  if (key.includes("ship") || key.includes("pick") || key.includes("transit")) return FiTruck;
  if (key.includes("confirm") || key.includes("accept")) return FiCheckCircle;
  if (key.includes("placed") || key.includes("received")) return FiClipboard;
  if (key.includes("pack") || key.includes("process")) return FiPackage;
  return FiClock;
}

function ActivityTimeline({ events, detailed }) {
  if (!events?.length) {
    return <p className="muted">No tracking activity is available yet.</p>;
  }

  return (
    <ol className="tracking-timeline">
      {events.map((event, index) => {
        const Icon = eventIcon(event);
        return (
          <li key={event.id} className={cx("tracking-event", index === 0 && "is-latest")}>
            <span className="tracking-event-icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="tracking-event-body">
              <div className="tracking-event-head">
                <strong>{event.title}</strong>
                {index === 0 ? <Badge tone="brand">Latest</Badge> : null}
              </div>
              {detailed && event.description ? <p>{event.description}</p> : null}
              <p className="tracking-event-meta">
                <span>{event.occurredAt ? formatDateTime(event.occurredAt) : "Time not recorded"}</span>
                {detailed && event.location ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>
                      <FiMapPin aria-hidden="true" /> {event.location}
                    </span>
                  </>
                ) : null}
                {detailed && event.source ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{event.source}</span>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DetailRow({ label, children, strong = false }) {
  return (
    <div className="tracking-detail-row">
      <dt>{label}</dt>
      <dd className={strong ? "is-strong" : undefined}>{children}</dd>
    </div>
  );
}

export default function TrackOrderPage() {
  const { user, isAuthenticated } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [state, setState] = useState({ loading: false, error: "", notFound: false, order: null });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const requestRef = useRef(0);
  const initialQueryRef = useRef(false);
  const copyTimerRef = useRef(null);

  const lookupOrder = useCallback(async (rawOrderId, { keepOrder = false } = {}) => {
    const id = parseOrderId(rawOrderId);
    if (!id) {
      setFormError("Enter the order number shown on your receipt or in your account.");
      setState((current) => ({ ...current, loading: false, error: "", notFound: false, order: keepOrder ? current.order : null }));
      return null;
    }

    const requestId = ++requestRef.current;
    setFormError("");
    setState((current) => ({
      loading: true,
      error: "",
      notFound: false,
      order: keepOrder ? current.order : null,
    }));

    try {
      const body = await api.get(`api/orders/${id}`, { auth: false });
      if (requestRef.current !== requestId) return null;
      const nextOrder = body?.data || null;
      setState({ loading: false, error: "", notFound: false, order: nextOrder });
      setLastCheckedAt(new Date().toISOString());
      return nextOrder;
    } catch (err) {
      if (requestRef.current !== requestId) return null;
      if (err.status === 404) {
        setState({ loading: false, error: "", notFound: true, order: null });
      } else {
        setState((current) => ({
          loading: false,
          error: err.message || "The order could not be loaded.",
          notFound: false,
          order: keepOrder ? current.order : null,
        }));
      }
      return null;
    }
  }, []);

  // Support links such as /track-order?order=8 from My Orders, receipts or support.
  useEffect(() => {
    if (initialQueryRef.current || typeof window === "undefined") return;
    initialQueryRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const queryOrder = params.get("order") || params.get("order_id") || params.get("orderId") || params.get("id") || "";
    const queryPhone = params.get("phone") || "";
    if (queryPhone) setPhone(queryPhone);
    if (queryOrder) {
      setOrderId(queryOrder);
      lookupOrder(queryOrder);
    }
  }, [lookupOrder]);

  // Signed-in shoppers can open one of their own recent orders without typing.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setRecentOrders([]);
      return undefined;
    }

    let alive = true;
    setRecentLoading(true);
    api
      .get("api/account/orders", { params: { page: 1, per_page: 5 } })
      .then((body) => {
        if (alive) setRecentOrders(normalizeOrders(body?.data).slice(0, 5));
      })
      .catch(() => {
        if (alive) setRecentOrders([]);
      })
      .finally(() => {
        if (alive) setRecentLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const lookup = async (event) => {
    event.preventDefault();
    if (state.loading) return;
    if (phone && !isValidBdPhone(phone)) {
      setFormError("Enter a valid Bangladeshi mobile number, or leave the phone field blank if you are signed in as the order owner.");
      return;
    }
    await lookupOrder(orderId);
  };

  const openRecentOrder = async (recent) => {
    setOrderId(String(recent.id));
    await lookupOrder(recent.id);
  };

  const copyText = async (key, text) => {
    if (!text) return;
    try {
      await navigator.Clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopiedKey(key);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(""), 1800);
  };

  const order = state.order;
  const tracking = order ? buildTrackingModel(order) : null;
  const courier = tracking?.tracking;
  const ownsAccount = Boolean(order && user && order.user_id && String(order.user_id) === String(user.id));
  const enteredPhone = normalizePhone(phone);
  const guestPhone = normalizePhone(order?.guest?.phone || "");
  const phoneMatches = Boolean(enteredPhone && guestPhone && enteredPhone === guestPhone);
  const revealed = Boolean(order) && (ownsAccount || phoneMatches);
  const status = order ? orderStatusMeta(order.status) : null;
  const payment = order ? paymentStatusMeta(order.payment_status) : null;
  const HeroIcon = statusHeroIcon(tracking);
  const orderNumber = order ? formatOrderNumber(order) : "";
  const recipientName = order?.guest?.name || (ownsAccount ? user?.name : "") || order?.name || "";
  const destination = titleCasePlace(order?.district) || "Delivery destination";
  const itemLines = order?.items?.length || 0;
  const itemUnits = (order?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const total = Number(order?.total_amount) || 0;
  const shippingFee = Number(order?.shipping_fee) || 0;
  const advance = Number(order?.advance_payment) || 0;
  const subtotal = Math.max(total - shippingFee, 0);
  const amountDue = String(order?.payment_status || "").toLowerCase() === "paid" ? 0 : Math.max(total - advance, 0);

  const verificationMessage = !order
    ? ""
    : order.guest
      ? enteredPhone && !phoneMatches
        ? "The phone number entered does not match this guest order. Check it and search again to unlock delivery details."
        : "Enter the phone number used on this order to unlock the address, items and courier tracking ID."
      : "This order belongs to a customer account. Sign in with that account to unlock the address, items and courier tracking ID.";

  return (
    <div className="tracking-page">
      <header className="tracking-hero">
        <span className="tracking-hero-icon" aria-hidden="true">
          <FiTruck />
        </span>
        <p className="eyebrow">Delivery tracking</p>
        <h1>Track your shipment</h1>
        <p>
          Follow your parcel from order confirmation to your doorstep. Enter the order number and the
          phone number used at checkout, or sign in to the account that placed it.
        </p>
      </header>

      <Card className="tracking-search-card" aria-label="Find a shipment">
        <form onSubmit={lookup} noValidate>
          <div className="tracking-search-grid">
            <Field label="Order number" htmlFor="tracking-order-id" required hint="For example 11 or ORD-00011.">
              <Input
                id="tracking-order-id"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="ORD-00011"
              />
            </Field>
            <Field label="Phone number" htmlFor="tracking-phone" hint="Required to unlock guest-order details.">
              <Input
                id="tracking-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="01712345678"
              />
            </Field>
            <Button variant="primary" type="submit" icon={FiSearch} loading={state.loading} disabled={state.loading} className="tracking-search-button">
              {state.loading ? "Tracking…" : "Track shipment"}
            </Button>
          </div>

          {formError ? (
            <p className="notice notice-warn tracking-form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <p className="tracking-privacy-note">
            <FiLock aria-hidden="true" />
            Shipment status is shown by order number. Address, items and courier tracking ID stay hidden until ownership is verified.
          </p>
        </form>

        {isAuthenticated && (recentLoading || recentOrders.length > 0) ? (
          <div className="tracking-recent">
            <p>Your recent orders</p>
            {recentLoading ? (
              <Skeleton style={{ height: 38 }} />
            ) : (
              <div className="tracking-recent-list">
                {recentOrders.map((recent) => {
                  const recentStatus = orderStatusMeta(recent.status);
                  return (
                    <button key={recent.id} type="button" className="tracking-recent-chip" onClick={() => openRecentOrder(recent)}>
                      <span className="num">{formatOrderNumber(recent)}</span>
                      <Badge tone={recentStatus.tone}>{recentStatus.label}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {state.loading && !order ? (
        <div className="tracking-loading" aria-label="Loading tracking information">
          <Skeleton style={{ height: 380 }} />
          <Skeleton style={{ height: 240 }} />
        </div>
      ) : null}

      {state.error ? (
        <div className="tracking-feedback">
          <ErrorState message={state.error} onRetry={() => lookupOrder(order?.id || orderId, { keepOrder: Boolean(order) })} />
        </div>
      ) : null}

      {state.notFound ? (
        <div className="tracking-feedback">
          <EmptyState
            icon={FiPackage}
            title="No order with that number"
            text="Check the number on your receipt, or sign in and open My Orders to pick the order from your account."
            action={
              <Button href="/user/orders" variant="ghost">
                Open my orders
              </Button>
            }
          />
        </div>
      ) : null}

      {order && tracking ? (
        <section className="tracking-result" aria-live="polite">
          <div className="tracking-result-grid">
            <Card className="tracking-main-card">
              <div className="tracking-order-head">
                <div>
                  <p className="eyebrow">Shipment for</p>
                  <h2 className="num">{orderNumber}</h2>
                  <p className="muted">Placed {formatDateTime(order.created_at)}</p>
                </div>
                <div className="tracking-head-actions">
                  <button
                    type="button"
                    className="icon-btn tracking-icon-action"
                    onClick={() => copyText("order", orderNumber)}
                    aria-label={`Copy order number ${orderNumber}`}
                    title="Copy order number"
                  >
                    {copiedKey === "order" ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={FiRefreshCw}
                    loading={state.loading}
                    disabled={state.loading}
                    onClick={() => lookupOrder(order.id, { keepOrder: true })}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="tracking-badges">
                {status ? <Badge tone={status.tone}>Order: {status.label}</Badge> : null}
                {payment ? <Badge tone={payment.tone}>Payment: {payment.label}</Badge> : null}
                {courier?.courierName ? <Badge tone="brand">{courier.courierName}</Badge> : null}
                {lastCheckedAt ? <span className="tracking-last-checked">Last checked {formatDateTime(lastCheckedAt)}</span> : null}
              </div>

              <div className={cx("tracking-status-hero", `tracking-status-hero--${tracking.tone}`)}>
                <span className="tracking-status-icon" aria-hidden="true">
                  <HeroIcon />
                </span>
                <div>
                  <p className="tracking-status-kicker">Current shipment status</p>
                  <h3>{tracking.headline}</h3>
                  <p>{tracking.description}</p>
                  <p className="tracking-status-updated">
                    Last update: {tracking.lastUpdatedAt ? formatDateTime(tracking.lastUpdatedAt) : "Not recorded"}
                    {tracking.tracking.estimatedDeliveryAt && !tracking.isDelivered
                      ? ` · Estimated delivery ${formatDateTime(tracking.tracking.estimatedDeliveryAt)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div
                className="tracking-progress"
                role="progressbar"
                aria-label="Delivery progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={tracking.progressPercent}
              >
                <span style={{ width: `${tracking.progressPercent}%` }} />
              </div>

              <Stepper steps={tracking.steps} progressPercent={tracking.progressPercent} isCancelled={tracking.isCancelled} />

              <div className="tracking-activity-head">
                <div>
                  <p className="eyebrow">Timeline</p>
                  <h3>Tracking activity</h3>
                </div>
                <span className="muted">{tracking.activity.length} update{tracking.activity.length === 1 ? "" : "s"}</span>
              </div>
              <ActivityTimeline events={tracking.activity} detailed={revealed} />
              {!courier?.events?.length ? (
                <p className="tracking-source-note">
                  {tracking.isDelivered
                    ? "This timeline shows the delivery milestones currently available for this order."
                    : tracking.isCancelled
                      ? "No further checkpoints will be added because this order was cancelled."
                      : "New checkpoints will appear here as your parcel moves through each delivery stage."}
                </p>
              ) : null}
            </Card>

            <aside className="tracking-side">
              <Card className="tracking-side-card">
                <div className="tracking-side-title">
                  <span aria-hidden="true">
                    <FiTruck />
                  </span>
                  <div>
                    <p className="eyebrow">Courier</p>
                    <h3>Shipment details</h3>
                  </div>
                </div>

                {courier?.hasCourierData ? (
                  <>
                    <dl className="tracking-details">
                      <DetailRow label="Courier">{courier.courierName || "Assigned courier"}</DetailRow>
                      <DetailRow label="Courier status">
                        {courier.shipmentStatus ? humanizeStatus(courier.shipmentStatus) : tracking.headline}
                      </DetailRow>
                      <DetailRow label="Tracking ID">
                        {courier.trackingId ? (
                          revealed ? (
                            <span className="tracking-id-row">
                              <code>{courier.trackingId}</code>
                              <button
                                type="button"
                                className="icon-btn tracking-copy-btn"
                                onClick={() => copyText("tracking", courier.trackingId)}
                                aria-label="Copy courier tracking ID"
                                title="Copy tracking ID"
                              >
                                {copiedKey === "tracking" ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                              </button>
                            </span>
                          ) : (
                            <span className="tracking-locked-value">
                              <FiLock aria-hidden="true" /> Verify to view
                            </span>
                          )
                        ) : (
                          "Not assigned yet"
                        )}
                      </DetailRow>
                      {courier.estimatedDeliveryAt ? (
                        <DetailRow label={tracking.isDelivered ? "Delivery estimate" : "Estimated delivery"}>
                          {formatDateTime(courier.estimatedDeliveryAt)}
                        </DetailRow>
                      ) : null}
                      {revealed && courier.currentLocation ? <DetailRow label="Latest location">{courier.currentLocation}</DetailRow> : null}
                      <DetailRow label="Last courier update">
                        {tracking.lastUpdatedAt ? formatDateTime(tracking.lastUpdatedAt) : "Not recorded"}
                      </DetailRow>
                    </dl>
                    {revealed && courier.trackingUrl ? (
                      <a className="btn btn-outline tracking-external-btn" href={courier.trackingUrl} target="_blank" rel="noreferrer">
                        Open courier tracking <FiExternalLink aria-hidden="true" />
                      </a>
                    ) : null}
                  </>
                ) : (
                  <div className="tracking-empty-box">
                    <FiTruck aria-hidden="true" />
                    <strong>
                      {tracking.isCancelled
                        ? "No shipment created"
                        : tracking.isDelivered
                          ? "Courier details unavailable"
                          : tracking.currentStepIndex >= 3
                            ? "Courier details updating"
                            : "Courier details pending"}
                    </strong>
                    <p>
                      {tracking.isCancelled
                        ? "This order was cancelled before delivery could continue."
                        : tracking.isDelivered
                          ? "Courier information for this delivered parcel is not available in the tracking record."
                          : tracking.currentStepIndex >= 3
                            ? "Courier information is being updated for this shipment. Please check again shortly."
                            : "A courier and tracking ID will appear here after your parcel is handed over for delivery."}
                    </p>
                  </div>
                )}
              </Card>

              <Card className="tracking-side-card">
                <div className="tracking-side-title">
                  <span aria-hidden="true">
                    <FiMapPin />
                  </span>
                  <div>
                    <p className="eyebrow">Route</p>
                    <h3>Delivery destination</h3>
                  </div>
                </div>

                <div className="tracking-route">
                  <div className="tracking-route-point">
                    <span className="tracking-route-dot is-origin" aria-hidden="true" />
                    <div>
                      <span>From</span>
                      <strong>Zuberee</strong>
                      <p>Order origin</p>
                    </div>
                  </div>
                  <div className="tracking-route-point">
                    <span className="tracking-route-dot is-destination" aria-hidden="true" />
                    <div>
                      <span>To</span>
                      <strong>{revealed && recipientName ? recipientName : destination}</strong>
                      <p>{revealed ? order.shipping_address || destination : `${destination} · full address hidden until verification`}</p>
                    </div>
                  </div>
                </div>

                {!revealed ? (
                  <div className="tracking-verification-box">
                    <FiShield aria-hidden="true" />
                    <p>{verificationMessage}</p>
                    {!order.guest && !isAuthenticated ? (
                      <Button href={`/login?next=${encodeURIComponent(`/track-order?order=${order.id}`)}`} variant="primary" size="sm">
                        Sign in to unlock
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>

              <Card className="tracking-side-card">
                <div className="tracking-side-title">
                  <span aria-hidden="true">
                    <FiShoppingBag />
                  </span>
                  <div>
                    <p className="eyebrow">Parcel</p>
                    <h3>Order summary</h3>
                  </div>
                </div>

                {revealed ? (
                  <ul className="tracking-items">
                    {(order.items || []).map((item, index) => (
                      <li key={item.id ?? index}>
                        <span>
                          {item.title || `Product ${item.product_id}`}
                          {item.sku ? <small>{item.sku}</small> : null}
                        </span>
                        <span className="muted">× {item.quantity}</span>
                        <strong className="num">{formatMoney(item.subtotal)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tracking-summary-hidden">
                    {itemLines} item line{itemLines === 1 ? "" : "s"} · {itemUnits} unit{itemUnits === 1 ? "" : "s"}. Item details unlock after verification.
                  </p>
                )}

                <dl className="tracking-details tracking-money">
                  <DetailRow label="Subtotal">{formatMoney(subtotal)}</DetailRow>
                  <DetailRow label="Delivery fee">{formatMoney(shippingFee)}</DetailRow>
                  {advance > 0 ? <DetailRow label="Advance paid">−{formatMoney(advance)}</DetailRow> : null}
                  <DetailRow label="Order total" strong>
                    {formatMoney(total)}
                  </DetailRow>
                  <DetailRow label={amountDue > 0 ? "Amount due" : "Payment"}>
                    {amountDue > 0 ? `${formatMoney(amountDue)} · ${humanizeStatus(order.payment_method || "cash on delivery")}` : "Paid"}
                  </DetailRow>
                </dl>
              </Card>
            </aside>
          </div>
        </section>
      ) : null}

      {!order && !state.loading && !state.notFound ? (
        <section className="tracking-features" aria-label="Tracking features">
          <article>
            <FiPackage aria-hidden="true" />
            <h2>Live order status</h2>
            <p>See confirmation, preparation, shipping and delivery in one clear progress timeline.</p>
          </article>
          <article>
            <FiTruck aria-hidden="true" />
            <h2>Courier-ready</h2>
            <p>Once a parcel is handed to a courier, its tracking ID, estimated delivery date and scan updates appear here.</p>
          </article>
          <article>
            <FiShield aria-hidden="true" />
            <h2>Private details protected</h2>
            <p>Address and parcel contents unlock only for the order owner or matching guest phone.</p>
          </article>
        </section>
      ) : null}

      <p className="tracking-support">
        Something wrong with an order? <Link href="/return_policy" className="link-arrow">Read our return policy</Link> or contact the shop
        with your order number.
      </p>
    </div>
  );
}
