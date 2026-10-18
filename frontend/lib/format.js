import { imgUrl } from "@/lib/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatOrderNumber(order) {
  const value = typeof order === "object" && order !== null
    ? order.order_number ?? order.orderNumber ?? order.id
    : order;
  if (value === null || value === undefined || value === "") return "ORD-00000";
  const text = String(value);
  if (/^ORD-/i.test(text)) return text.toUpperCase();
  return `ORD-${text.padStart(5, "0")}`;
}

/** "14 Oct 2026, 10:45" – built by hand so SSR and client output are identical. */
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** YYYY-MM-DD in local time, for <input type="date"> and API params. */
export function toDateInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

  const sizes = (Array.isArray(raw.sizes) ? raw.sizes : []).map((size) => {
    const pivot = size?.pivot || {};
    const sizePrice = pivot.price === null || pivot.price === undefined ? null : num(pivot.price);
    return {
      id: size?.id ?? null,
      label: size?.size ?? size?.value ?? "",
      stock: num(pivot.stock, 0),
      price: sizePrice,
    };
  });

  const category = Array.isArray(raw.category) ? raw.category[0] : raw.category;
  const status = String(raw.status || "in-stock").toLowerCase().replaceAll("_", "-");
  const tracked = Boolean(raw.track_inventory ?? raw.inventory?.track_inventory);

  let availability = "in-stock";
  if (status === "pre-order" || status === "preorder" || status === "pre_order") availability = "pre-order";
  else if (status === "out-of-stock" || status === "sold-out") availability = "sold-out";
  else if (tracked && sizes.length > 0 && sizes.every((size) => size.stock <= 0)) availability = "sold-out";

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
