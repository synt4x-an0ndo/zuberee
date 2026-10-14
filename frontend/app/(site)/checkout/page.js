"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FiCheckCircle, FiPhone, FiTruck } from "react-icons/fi";
import { Button, EmptyState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, isValidBdPhone, normalizePhone, unwrap } from "@/lib/api";
import { DISTRICTS } from "@/lib/districts";
import { shippingQuote } from "@/lib/shipping";
import { formatDateTime, formatOrderNumber } from "@/lib/format";

const EMPTY_FORM = { name: "", phone: "", district: "", address: "", addressId: "" };

/** Saved addresses store a city; map it onto a district value when it matches one. */
function districtFromCity(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return "";
  return DISTRICTS.find((d) => d.value === c || d.label.toLowerCase() === c)?.value || "";
}

export default function CheckoutPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { cart, loading: cartLoading, refresh } = useCart();
  const { toast } = useFeedback();

  const savedAddresses = useMemo(() => user?.addresses || [], [user]);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, name: "", phone: "" }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [touchedUser, setTouchedUser] = useState(false);

  // Prefill from the account once it is known, unless the shopper has already typed.
  const effective = useMemo(() => {
    if (!isAuthenticated || touchedUser) return form;
    const first = savedAddresses[0];
    return {
      ...form,
      name: form.name || user?.name || "",
      phone: form.phone || user?.phone || first?.phone || "",
      addressId: form.addressId || (first ? String(first.id) : ""),
      district: form.district || districtFromCity(first?.city),
    };
  }, [form, isAuthenticated, touchedUser, user, savedAddresses]);

  const savedChoice = isAuthenticated && effective.addressId ? savedAddresses.find((a) => String(a.id) === effective.addressId) || null : null;
  const usingSavedAddress = Boolean(savedChoice);
  const district = effective.district;
  const quote = shippingQuote(district);
  const shippingFee = quote.fee ?? 0;
  const total = cart.subtotal + shippingFee;

  const set = (key) => (event) => {
    setTouchedUser(true);
    setForm({ ...effective, [key]: event.target.value });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const pickSavedAddress = (id) => {
    setTouchedUser(true);
    const address = savedAddresses.find((a) => String(a.id) === id);
    setForm({
      ...effective,
      addressId: id,
      district: districtFromCity(address?.city) || effective.district,
      name: address?.fullName || effective.name,
      phone: address?.phone || effective.phone,
      address: address ? [address.addressLine, address.city, address.postalCode].filter(Boolean).join(", ") : "",
    });
  };

  const validate = () => {
    const next = {};
    if (!effective.name.trim()) next.name = "Please enter your full name.";
    if (!isValidBdPhone(effective.phone)) next.phone = "Enter a valid Bangladeshi mobile number (01XXXXXXXXX).";
    if (!effective.district) next.district = "Please choose your district.";
    if (!usingSavedAddress && (!effective.address.trim() || effective.address.trim().length < 8)) next.address = "Enter your full delivery address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || cart.items.length === 0) return;
    if (!validate()) return;

    const districtLabel = DISTRICTS.find((d) => d.value === effective.district)?.label || effective.district;
    const fullAddress = `${effective.address.trim()}, ${districtLabel}`;
    const payload = {
      guestName: effective.name.trim(),
      guestPhone: normalizePhone(effective.phone),
      guestAddress: fullAddress,
      district: effective.district,
      shippingFee,
      advancePayment: 0,
      paymentMethod: "cash",
    };
    if (isAuthenticated) {
      if (usingSavedAddress) payload.shippingAddressId = Number(effective.addressId);
      else payload.shippingAddress = fullAddress;
    }

    setSubmitting(true);
    try {
      const response = await api.post("api/orders", payload, { auth: isAuthenticated });
      setOrder(unwrap(response) || { id: null, total_amount: total });
      toast.success("Your order has been placed.");
      refresh();
    } catch (error) {
      toast.error(error.message || "We could not place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (order) {
    return (
      <div className="container section anim-scale-in">
        <div className="success-hero">
          <span className="success-icon"><FiCheckCircle aria-hidden="true" /></span>
          <h1>Thank you for your order</h1>
          <p className="muted">
            Order <strong className="num">{formatOrderNumber(order)}</strong> was placed on {formatDateTime(order.created_at || new Date().toISOString())}.
            We will call you on <strong className="num">{normalizePhone(effective.phone)}</strong> to confirm delivery.
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: "1.25rem" }}>
            {isAuthenticated && <Button href="/user/orders" variant="outline">View my orders</Button>}
            <Button href="/shop" variant="primary">Continue shopping</Button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || cartLoading) {
    return (
      <div className="container section">
        <Skeleton style={{ height: 36, width: 220, marginBottom: 24 }} />
        <Skeleton style={{ height: 420 }} />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="container section">
        <EmptyState title="Nothing to check out" text="Your cart is empty. Add something you love first." action={<Button href="/shop" variant="primary">Shop now</Button>} />
      </div>
    );
  }

  return (
    <div className="container section anim-fade-up">
      <div className="page-header">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Delivery details</h1>
        </div>
        {!isAuthenticated && (
          <p className="muted">
            Have an account? <Link href="/login?next=/checkout" className="link-arrow">Sign in</Link> to use saved addresses.
          </p>
        )}
      </div>

      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="card card-pad stack">
          {isAuthenticated && savedAddresses.length > 0 && (
            <fieldset className="address-picker" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label" style={{ marginBottom: 8 }}>Saved addresses</legend>
              <div className="address-options">
                {savedAddresses.map((a) => (
                  <label key={a.id} className={`address-option ${effective.addressId === String(a.id) ? "is-active" : ""}`}>
                    <input type="radio" name="savedAddress" value={a.id} checked={effective.addressId === String(a.id)} onChange={() => pickSavedAddress(String(a.id))} />
                    <span>
                      <strong>{a.fullName}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.88rem" }}>
                        {[a.addressLine, a.city].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </label>
                ))}
                <label className={`address-option ${effective.addressId === "" ? "is-active" : ""}`}>
                  <input type="radio" name="savedAddress" value="" checked={effective.addressId === ""} onChange={() => { setTouchedUser(true); setForm({ ...effective, addressId: "" }); }} />
                  <span><strong>Use a different address</strong></span>
                </label>
              </div>
            </fieldset>
          )}

          <div className="form-grid">
            <Field label="Full name" htmlFor="ck-name" required error={errors.name}>
              <Input id="ck-name" autoComplete="name" value={effective.name} onChange={set("name")} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Mobile number" htmlFor="ck-phone" required error={errors.phone} hint="We use this to confirm your order.">
              <Input id="ck-phone" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={effective.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
            </Field>
          </div>

          <Field label="District" htmlFor="ck-district" required error={errors.district}>
            <Select id="ck-district" placeholder="Select your district" options={DISTRICTS} value={effective.district} onChange={set("district")} aria-invalid={!!errors.district} />
          </Field>

          {usingSavedAddress ? (
            <div className="notice notice-info" style={{ margin: 0 }}>
              <strong>Delivering to:</strong> {savedChoice && [savedChoice.fullName, savedChoice.phone, savedChoice.addressLine, savedChoice.city, savedChoice.postalCode].filter(Boolean).join(", ")}
            </div>
          ) : (
            <Field label="Delivery address" htmlFor="ck-address" required error={errors.address} hint="House, road, area and landmark.">
              <Textarea id="ck-address" rows={3} autoComplete="street-address" value={effective.address} onChange={set("address")} aria-invalid={!!errors.address} />
            </Field>
          )}

          <div>
            <p className="field-label" style={{ marginBottom: 8 }}>Payment</p>
            <label className="pay-option is-active">
              <input type="radio" name="payment" value="cash" checked readOnly />
              <span>
                <strong>Cash on delivery</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.88rem" }}>Pay the courier when your order arrives.</span>
              </span>
            </label>
          </div>
        </div>

        <aside className="summary" aria-label="Order summary">
          <h2 style={{ fontSize: "1.15rem" }}>Your order</h2>
          <ul className="summary-items" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {cart.items.map((item) => (
              <li key={item.id} className="summary-item">
                <span>
                  {item.title} <span className="muted">× {item.quantity}</span>
                  {item.variant?.label && <span className="muted" style={{ display: "block", fontSize: "0.84rem" }}>Size {item.variant.label}</span>}
                </span>
                <span className="num">{formatMoney(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row">
            <span>Subtotal</span>
            <span className="num">{formatMoney(cart.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span><FiTruck aria-hidden="true" /> Delivery</span>
            <span className="num">
              {!district ? "Choose district" : quote.confirmed ? formatMoney(shippingFee) : "Confirmed on call"}
            </span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span className="num">{quote.confirmed || !district ? formatMoney(total) : `${formatMoney(cart.subtotal)} + delivery`}</span>
          </div>
          {!quote.confirmed && district && (
            <p className="notice notice-info" style={{ margin: 0 }}>
              <FiPhone aria-hidden="true" /> Our team will confirm the delivery charge for your area when we call.
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block loading={submitting} disabled={submitting}>
            Place order
          </Button>
        </aside>
      </form>
    </div>
  );
}
