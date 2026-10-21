import { courierLabel } from "./couriers.js";

/**
 * Frontend tracking adapter.
 *
 * Today this is driven by the existing public order response:
 *   GET /api/orders/:id -> status, payment_status, created_at, updated_at,
 *   district, shipping_address, totals and items.
 *
 * No courier columns/events exist in that response yet. The field aliases
 * below deliberately accept the shipment/tracking shapes documented in
 * frontend/COURIER_TRACKING_API_CONTRACT.md, so the backend can add those
 * fields later without another tracking-page rewrite.
 */

export const TRACKING_STEPS = [
  {
    key: "placed",
    label: "Order placed",
    shortLabel: "Placed",
    description: "We received your order.",
    icon: "receipt",
  },
  {
    key: "confirmed",
    label: "Order confirmed",
    shortLabel: "Confirmed",
    description: "The shop confirmed your order.",
    icon: "check",
  },
  {
    key: "processing",
    label: "Preparing parcel",
    shortLabel: "Processing",
    description: "Your items are being prepared for dispatch.",
    icon: "package",
  },
  {
    key: "shipped",
    label: "Shipped / in transit",
    shortLabel: "Shipped",
    description: "Your parcel is moving through the delivery network.",
    icon: "truck",
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    shortLabel: "Out for delivery",
    description: "The courier is on the way to the delivery address.",
    icon: "navigation",
  },
  {
    key: "delivered",
    label: "Delivered",
    shortLabel: "Delivered",
    description: "Your order has been delivered.",
    icon: "home",
  },
];

const INTERNAL_STEP_INDEX = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
};

const STEP_TIME_FIELDS = {
  confirmed: ["confirmed_at", "confirmedAt"],
  processing: ["processing_at", "processingAt", "packed_at", "packedAt"],
  shipped: ["shipped_at", "shippedAt", "picked_up_at", "pickedUpAt", "dispatched_at", "dispatchedAt"],
  out_for_delivery: ["out_for_delivery_at", "outForDeliveryAt"],
  delivered: ["delivered_at", "deliveredAt"],
};

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function firstPresent(object, keys) {
  if (!object || typeof object !== "object") return undefined;
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && value !== "" && value !== 0) return value;
  }
  return undefined;
}

function textValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) return String(value);
  return "";
}

function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sameTime(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function compactStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]{2,4}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function safeHttpUrl(value) {
  const text = textValue(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function getShipmentObject(order) {
  return (
    asObject(order?.shipment) ||
    asObject(order?.tracking) ||
    asObject(order?.delivery) ||
    asObject(order?.courier_shipment) ||
    asObject(order?.courierShipment) ||
    {}
  );
}

function getRawCourierValue(order, shipment) {
  const courierObject = asObject(order?.courier);
  return (
    firstPresent(order, [
      "courier_entry",
      "courierEntry",
      "courier_name",
      "courierName",
      "courier_slug",
      "courierSlug",
      "delivery_partner",
      "deliveryPartner",
    ]) ||
    firstPresent(shipment, ["courier", "courier_name", "courierName", "courier_slug", "courierSlug", "provider", "name"]) ||
    firstPresent(courierObject, ["slug", "code", "value", "name", "label"]) ||
    (typeof order?.courier === "string" ? order.courier : undefined)
  );
}

function normalizeEvent(raw, index) {
  if (!raw || typeof raw !== "object") return null;

  const status = textValue(firstPresent(raw, ["status", "status_key", "statusKey", "code", "event", "type"]));
  const title =
    textValue(firstPresent(raw, ["title", "label", "status_label", "statusLabel", "name", "event_name", "eventName"])) ||
    titleCase(status) ||
    "Tracking update";
  const description = textValue(firstPresent(raw, ["description", "message", "details", "detail", "note", "remark", "remarks"]));
  const location = textValue(firstPresent(raw, ["location", "place", "hub", "branch", "facility", "address"]));
  const occurredAt = dateValue(
    firstPresent(raw, ["occurred_at", "occurredAt", "timestamp", "time", "date", "created_at", "createdAt", "updated_at", "updatedAt"])
  );
  const source = textValue(firstPresent(raw, ["source", "provider", "courier", "courier_name", "courierName"])) || "Courier";

  return {
    id: raw.id ?? `${status || title}-${occurredAt || index}-${index}`,
    status,
    statusKey: compactStatus(status || title),
    title,
    description,
    location,
    occurredAt,
    source,
    originalIndex: index,
  };
}

function getCourierEvents(order, shipment) {
  const candidates = [
    order?.tracking_events,
    order?.trackingEvents,
    order?.status_history,
    order?.statusHistory,
    order?.timeline,
    order?.events,
    shipment?.events,
    shipment?.tracking_events,
    shipment?.trackingEvents,
    shipment?.history,
    asObject(order?.courier)?.events,
  ];
  const rawEvents = candidates.find(Array.isArray) || [];
  const events = rawEvents.map(normalizeEvent).filter(Boolean);

  // Newest first for the activity feed. Undated provider rows keep their
  // relative order after dated rows instead of being shuffled.
  return events.sort((a, b) => {
    if (a.occurredAt && b.occurredAt) return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (a.occurredAt) return -1;
    if (b.occurredAt) return 1;
    return a.originalIndex - b.originalIndex;
  });
}

function eventMatchesStep(event, stepKey) {
  const haystack = `${event.statusKey} ${compactStatus(event.title)}`;
  const needles = {
    placed: ["placed", "created", "received", "orderplaced", "orderreceived"],
    confirmed: ["confirmed", "accepted", "approved"],
    processing: ["processing", "packed", "packing", "preparing", "ready", "readytoship"],
    shipped: ["shipped", "pickedup", "pickup", "handed", "dispatched", "intransit", "departed"],
    out_for_delivery: ["outfordelivery", "onitsway", "withcourier", "deliveryattempt"],
    delivered: ["delivered", "completed", "successful"],
    cancelled: ["cancelled", "canceled", "void"],
  }[stepKey] || [];
  return needles.some((needle) => haystack.includes(needle));
}

function findStepEvent(events, stepKey) {
  // Events are newest-first; the last match is therefore the earliest one.
  return [...events].reverse().find((event) => eventMatchesStep(event, stepKey)) || null;
}

function getStepOccurredAt(order, shipment, events, stepKey, currentStepKey, updatedAt) {
  const direct = dateValue(firstPresent(order, STEP_TIME_FIELDS[stepKey] || []) || firstPresent(shipment, STEP_TIME_FIELDS[stepKey] || []));
  if (direct) return direct;

  const event = findStepEvent(events, stepKey);
  if (event?.occurredAt) return event.occurredAt;

  // The current backend only exposes created_at + updated_at. updated_at can
  // honestly label the current step as "last recorded", but it must not be
  // copied backwards onto earlier steps as if their times were known.
  if (stepKey === currentStepKey && updatedAt && !sameTime(updatedAt, order.created_at || order.createdAt)) return updatedAt;
  return null;
}

function statusHeadline(effectiveKey, rawShipmentStatus) {
  const byKey = {
    pending: {
      headline: "Order received",
      description: "We have received your order. The shop will confirm it before preparation begins.",
      tone: "warn",
      icon: "clock",
    },
    confirmed: {
      headline: "Order confirmed",
      description: "Your order is confirmed and is waiting to be prepared for dispatch.",
      tone: "info",
      icon: "check",
    },
    processing: {
      headline: "Preparing your parcel",
      description: "Your items are being prepared and packed for courier handover.",
      tone: "info",
      icon: "package",
    },
    shipped: {
      headline: "In transit",
      description: "Your parcel has been shipped and is moving through the delivery network.",
      tone: "brand",
      icon: "truck",
    },
    out_for_delivery: {
      headline: "Out for delivery",
      description: "The courier is on the way. Please keep the delivery phone reachable.",
      tone: "brand",
      icon: "navigation",
    },
    delivered: {
      headline: "Delivered",
      description: "This order has been marked as delivered.",
      tone: "success",
      icon: "home",
    },
    cancelled: {
      headline: "Order cancelled",
      description: "This order was cancelled and will not be delivered.",
      tone: "danger",
      icon: "cancelled",
    },
  };

  if (byKey[effectiveKey]) return byKey[effectiveKey];

  const compact = compactStatus(rawShipmentStatus);
  if (compact.includes("fail") || compact.includes("return")) {
    return {
      headline: titleCase(rawShipmentStatus) || "Delivery issue",
      description: "The courier reported a delivery issue. Check the latest tracking activity or contact the shop.",
      tone: "danger",
      icon: "alert",
    };
  }
  if (compact.includes("hold") || compact.includes("delay")) {
    return {
      headline: titleCase(rawShipmentStatus) || "Shipment on hold",
      description: "The courier has paused or delayed this shipment. The latest activity is shown below.",
      tone: "warn",
      icon: "alert",
    };
  }

  return {
    headline: titleCase(rawShipmentStatus) || "Tracking update received",
    description: "The latest available shipment status is shown below.",
    tone: "neutral",
    icon: "truck",
  };
}

export function getTrackingDetails(order) {
  const shipment = getShipmentObject(order || {});
  const events = getCourierEvents(order || {}, shipment);
  const latestEvent = events[0] || null;
  const courierRaw = getRawCourierValue(order || {}, shipment);
  const courierText = textValue(courierRaw);
  const trackingId = textValue(
    firstPresent(order, [
      "tracking_id",
      "trackingId",
      "tracking_number",
      "trackingNumber",
      "consignment_id",
      "consignmentId",
      "consignment_number",
      "consignmentNumber",
      "awb",
      "waybill",
      "waybill_number",
      "waybillNumber",
      "courier_tracking_id",
      "courierTrackingId",
    ]) ||
      firstPresent(shipment, [
        "tracking_id",
        "trackingId",
        "tracking_number",
        "trackingNumber",
        "consignment_id",
        "consignmentId",
        "awb",
        "waybill",
        "id",
        "code",
      ])
  );
  const trackingUrl = safeHttpUrl(
    firstPresent(order, ["tracking_url", "trackingUrl", "courier_tracking_url", "courierTrackingUrl"]) ||
      firstPresent(shipment, ["tracking_url", "trackingUrl", "url", "link"])
  );
  const estimatedDeliveryAt = dateValue(
    firstPresent(order, [
      "estimated_delivery_at",
      "estimatedDeliveryAt",
      "estimated_delivery",
      "estimatedDelivery",
      "expected_delivery_at",
      "expectedDeliveryAt",
      "delivery_eta",
      "deliveryEta",
      "eta",
    ]) ||
      firstPresent(shipment, ["estimated_delivery_at", "estimatedDeliveryAt", "expected_delivery_at", "expectedDeliveryAt", "eta"])
  );
  const shipmentStatus = textValue(
    firstPresent(shipment, ["status", "shipment_status", "shipmentStatus", "delivery_status", "deliveryStatus"]) ||
      firstPresent(order, ["shipment_status", "shipmentStatus", "delivery_status", "deliveryStatus", "courier_status", "courierStatus"])
  );
  const currentLocation =
    textValue(firstPresent(shipment, ["current_location", "currentLocation", "location", "hub", "branch"])) ||
    textValue(firstPresent(order, ["current_location", "currentLocation", "courier_location", "courierLocation"])) ||
    latestEvent?.location ||
    "";
  const lastSyncedAt = dateValue(
    firstPresent(shipment, ["last_synced_at", "lastSyncedAt", "synced_at", "syncedAt", "updated_at", "updatedAt"]) ||
      firstPresent(order, ["tracking_updated_at", "trackingUpdatedAt", "shipment_updated_at", "shipmentUpdatedAt"])
  );

  return {
    courierSlug: courierText,
    courierName: courierText ? courierLabel(courierText) : "",
    trackingId,
    trackingUrl,
    estimatedDeliveryAt,
    shipmentStatus,
    currentLocation,
    lastSyncedAt,
    events,
    hasCourierData: Boolean(courierText || trackingId || trackingUrl || estimatedDeliveryAt || shipmentStatus || events.length),
  };
}

export function buildTrackingModel(order) {
  const safeOrder = order && typeof order === "object" ? order : {};
  const shipment = getShipmentObject(safeOrder);
  const tracking = getTrackingDetails(safeOrder);
  const internalStatus = String(safeOrder.status || "pending").trim().toLowerCase().replace(/-/g, "_");
  const isCancelled = internalStatus === "cancelled" || compactStatus(tracking.shipmentStatus) === "cancelled" || Boolean(findStepEvent(tracking.events, "cancelled"));
  const deliveredEvent = findStepEvent(tracking.events, "delivered");
  const isDelivered = internalStatus === "delivered" || Boolean(deliveredEvent);
  const outForDeliveryEvent = findStepEvent(tracking.events, "out_for_delivery");
  const shipmentStatusKey = compactStatus(tracking.shipmentStatus);

  let effectiveKey = internalStatus;
  if (isCancelled) effectiveKey = "cancelled";
  else if (isDelivered) effectiveKey = "delivered";
  else if (outForDeliveryEvent || shipmentStatusKey === "outfordelivery") effectiveKey = "out_for_delivery";
  else if (INTERNAL_STEP_INDEX[effectiveKey] === undefined) effectiveKey = "pending";

  const currentStepIndex = INTERNAL_STEP_INDEX[effectiveKey] ?? 0;
  const createdAt = dateValue(safeOrder.created_at || safeOrder.createdAt);
  const updatedAt = dateValue(safeOrder.updated_at || safeOrder.updatedAt);
  const cancelledAt = dateValue(
    firstPresent(safeOrder, ["cancelled_at", "cancelledAt", "canceled_at", "canceledAt"]) ||
      firstPresent(shipment, ["cancelled_at", "cancelledAt"]) ||
      findStepEvent(tracking.events, "cancelled")?.occurredAt ||
      updatedAt
  );

  const steps = TRACKING_STEPS.map((step, index) => {
    let state = "upcoming";
    if (isCancelled) state = index === 0 ? "complete" : "cancelled";
    else if (index < currentStepIndex || effectiveKey === "delivered") state = "complete";
    else if (index === currentStepIndex) state = "current";

    return {
      ...step,
      state,
      occurredAt:
        step.key === "placed"
          ? createdAt
          : getStepOccurredAt(safeOrder, shipment, tracking.events, step.key, TRACKING_STEPS[currentStepIndex]?.key, updatedAt),
    };
  });

  const placedEvent = {
    id: "derived-placed",
    status: "placed",
    statusKey: "placed",
    title: "Order placed",
    description: "Order received by Zuberee.",
    location: "",
    occurredAt: createdAt,
    source: "Zuberee",
  };

  let activity;
  if (tracking.events.length > 0) {
    activity = [...tracking.events];
    if (!findStepEvent(activity, "placed") && createdAt) activity.push(placedEvent);
  } else {
    activity = [];
    if (isCancelled) {
      activity.push({
        id: "derived-cancelled",
        status: "cancelled",
        statusKey: "cancelled",
        title: "Order cancelled",
        description: "This order was cancelled and will not be delivered.",
        location: "",
        occurredAt: cancelledAt,
        source: "Zuberee",
      });
    } else if (effectiveKey !== "pending") {
      const currentStep = TRACKING_STEPS[currentStepIndex];
      activity.push({
        id: `derived-${effectiveKey}`,
        status: effectiveKey,
        statusKey: compactStatus(effectiveKey),
        title: currentStep?.label || titleCase(effectiveKey),
        description: "Latest status recorded in the Zuberee order system.",
        location: "",
        occurredAt: getStepOccurredAt(safeOrder, shipment, [], effectiveKey, effectiveKey, updatedAt),
        source: "Zuberee",
      });
    }
    if (createdAt) activity.push(placedEvent);
  }

  const announcement = statusHeadline(effectiveKey, tracking.shipmentStatus || internalStatus);
  const progressPercent = isCancelled ? 0 : Math.round((currentStepIndex / (TRACKING_STEPS.length - 1)) * 100);

  return {
    internalStatus,
    effectiveKey,
    isCancelled,
    isDelivered,
    currentStepIndex,
    progressPercent,
    steps,
    activity,
    tracking,
    createdAt,
    updatedAt,
    cancelledAt,
    lastUpdatedAt: tracking.lastSyncedAt || activity[0]?.occurredAt || updatedAt,
    ...announcement,
  };
}
