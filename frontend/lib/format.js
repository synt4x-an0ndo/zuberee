import { imgUrl } from "@/lib/api";

// All customer and admin timestamps are shown in Bangladesh Standard Time,
// independent of the device, server, or browser time zone.
const BANGLADESH_TIME_ZONE = "Asia/Dhaka";

function bangladeshDateParts(value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGLADESH_TIME_ZONE,
    ...options,
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function formatOrderNumber(order) {
  const value = typeof order === "object" && order !== null
    ? order.order_number ?? order.orderNumber ?? order.id
    : order;
  if (value === null || value === undefined || value === "") return "ORD-00000";
  const text = String(value);
  if (/^ORD-/i.test(text)) return text.toUpperCase();
  return `ORD-${text.padStart(5, "0")}`;
}

/** "14 Oct 2026, 10:45" in Bangladesh Standard Time (Asia/Dhaka). */
export function formatDateTime(value) {
  if (!value) return "â€”";
  const parts = bangladeshDateParts(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  if (!parts) return "â€”";
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

/** Date-only values are also derived in Bangladesh Standard Time. */
export function formatDate(value) {
  if (!value) return "â€”";
  const parts = bangladeshDateParts(value, { day: "2-digit", month: "short", year: "numeric" });
  if (!parts) return "â€”";
  return `${parts.day} ${parts.month} ${parts.year}`;
}

/** YYYY-MM-DD in Bangladesh Standard Time, for date inputs and API params. */
export function toDateInput(value) {
  const parts = bangladeshDateParts(value, { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const ORDER_STATUS = {
  pending: { label: "Pending", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  shipped: { label: "Shipped", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const PAYMENT_STATUS = {
  pending: { label: "Unpaid", tone: "warn" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export function orderStatusMeta(status) {
  return ORDER_STATUS[String(status || "").toLowerCase()] || { label: status || "Unknown", tone: "neutral" };
}

export function paymentStatusMeta(status) {
  return PAYMENT_STATUS[String(status || "").toLowerCase()] || { label: status || "Unknown", tone: "neutral" };
}

/** Product status as the backend returns it: in-stock | out-of-stock | pre-order | sold-out. */
export const PRODUCT_STATUS_OPTIONS = [
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "pre-order", label: "Pre-order" },
  { value: "sold-out", label: "Sold out" },
];

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalise a product from any of the backend list/detail endpoints into one shape
 * the UI can rely on.
 */
export function normalizeProduct(raw) {
  if (!raw || typeof raw !== "object") return null;
  const price = num(raw.price);
  const discount = raw.discount === null || raw.discount === undefined || raw.discount === "" ? null : num(raw.discount);
  const hasSale = discount !== null && discount > 0 && discount < price;
  const salePrice = hasSale ? discount : price;

  const images = (Array.isArray(raw.images) ? raw.images : [])
    .map((image) => ({ id: image?.id ?? null, url: imgUrl(image) }))
    .filter((image) => image.url);

  const colors = (Array.isArray(raw.colors) ? raw.colors : []).map((color) => ({
    id: color?.id ?? null,
    name: color?.name || "Color",
    code: typeof color?.code === "string" && color.code ? color.code : null,
    image: imgUrl(color?.image),
  }));

  const rawStatus = String(raw.status || "in-stock").toLowerCase().replaceAll("_", "-");
  const productPreorder = rawStatus === "pre-order" || rawStatus === "preorder";

  const sizes = (Array.isArray(raw.sizes) ? raw.sizes : []).map((size) => {
    const pivot = size?.pivot || {};
    const sizePrice = pivot.price === null || pivot.price === undefined ? null : num(pivot.price);
    const stock = num(pivot.stock, 0);
    const allowPreorder = Boolean(pivot.allow_preorder ?? pivot.allowPreorder ?? productPreorder);
    const preorderLimit = pivot.preorder_limit === null || pivot.preorder_limit === undefined ? null : num(pivot.preorder_limit, 0);
    const preorderCount = num(pivot.preorder_count, 0);
    const preorderAvailable = pivot.preorder_available === null || pivot.preorder_available === undefined
      ? preorderLimit === null ? null : Math.max(0, preorderLimit - preorderCount)
      : num(pivot.preorder_available, 0);
    const orderCapacity = pivot.order_capacity === undefined
      ? allowPreorder ? (preorderAvailable === null ? null : Math.max(0, stock) + preorderAvailable) : Math.max(0, stock)
      : pivot.order_capacity === null ? null : num(pivot.order_capacity, 0);
    return {
      id: size?.id ?? null,
      label: size?.size ?? size?.value ?? "",
      stock,
      price: sizePrice,
      allowPreorder,
      preorderLimit,
      preorderCount,
      preorderAvailable,
      orderCapacity,
    };
  });

  const category = Array.isArray(raw.category) ? raw.category[0] : raw.category;
  const status = rawStatus;
  const tracked = Boolean(raw.track_inventory ?? raw.inventory?.track_inventory);
  const stock = num(raw.stock, 0);
  const orderCapacity = raw.order_capacity === undefined
    ? productPreorder ? null : Math.max(0, stock)
    : raw.order_capacity === null ? null : num(raw.order_capacity, 0);
  const hasSizeCapacity = sizes.some((size) => size.orderCapacity === null || size.orderCapacity > 0);
  const everySizeUnavailable = sizes.length > 0 && sizes.every((size) => size.orderCapacity === 0);

  // `order_capacity` is supplied by the backend after stock, held stock and
  // preorder capacity are considered. Use it rather than raw on-hand stock so
  // storefront availability matches the quantity an order may actually buy.
  let availability = "in-stock";
  if (productPreorder) availability = sizes.length === 0 || hasSizeCapacity ? "pre-order" : "sold-out";
  else if (status === "out-of-stock" || status === "sold-out") availability = "sold-out";
  else if (sizes.length > 0 && sizes.every((size) => size.stock <= 0) && hasSizeCapacity) availability = "pre-order";
  else if (everySizeUnavailable) availability = "sold-out";
  else if (sizes.length === 0 && orderCapacity === 0) availability = "sold-out";

  return {
    id: raw.id,
    title: raw.title || raw.name || "Untitled product",
    sku: raw.sku || "",
    price,
    discount,
    hasSale,
    salePrice,
    status,
    availability,
    stock,
    orderCapacity,
    shortDescription: raw.short_description || "",
    description: raw.description || "",
    videoUrl: raw.video_url || "",
    images,
    image: images[0]?.url || null,
    colors,
    sizes,
    tracked,
    category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    specifications: Array.isArray(raw.specifications) ? raw.specifications : [],
    faqs: Array.isArray(raw.faqs) ? raw.faqs : [],
  };
}

export function discountPercent(price, salePrice) {
  if (!price || !salePrice || salePrice >= price) return 0;
  return Math.round(((price - salePrice) / price) * 100);
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
