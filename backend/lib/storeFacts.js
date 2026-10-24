/**
 * Store facts the AI assistant is allowed to state as truth.
 *
 * Why this file exists: the size charts previously lived only inside
 * frontend/app/(site)/size-guide/page.js (a client component), and the
 * delivery/about/FAQ content lived only in the database. Nothing wired any of
 * it into POST /api/chat/ai, so the assistant would answer "I couldn't find a
 * size guide" and fall back to "chat with the admin".
 *
 * DRESS_SIZE_CHART and SHOE_SIZE_CHART below MUST stay identical to the tables
 * rendered by the size-guide page. The page is the visual source of truth; this
 * is the conversational copy of it.
 *
 * Pure module: no Prisma, no Next imports, so it is safe to unit test.
 */

export const DRESS_SIZE_CHART = [
    { size: "XS", bust: "32\u201333", waist: "26\u201327", hip: "35\u201336" },
    { size: "S", bust: "34\u201335", waist: "28\u201329", hip: "37\u201338" },
    { size: "M", bust: "36\u201337", waist: "30\u201331", hip: "39\u201340" },
    { size: "L", bust: "38\u201340", waist: "32\u201334", hip: "41\u201343" },
    { size: "XL", bust: "41\u201343", waist: "35\u201337", hip: "44\u201346" },
    { size: "XXL", bust: "44\u201346", waist: "38\u201340", hip: "47\u201349" },
];

export const SHOE_SIZE_CHART = [
    { size: "36", footLengthCm: "22.5" },
    { size: "37", footLengthCm: "23.5" },
    { size: "38", footLengthCm: "24.0" },
    { size: "39", footLengthCm: "25.0" },
    { size: "40", footLengthCm: "25.5" },
    { size: "41", footLengthCm: "26.5" },
    { size: "42", footLengthCm: "27.0" },
];

// Order lifecycle, in the order a shipment moves through it.
export const ORDER_STATUS_FLOW = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
];

export const ORDER_STATUS_NOTE = {
    PENDING: "placed, waiting for the store to confirm it",
    CONFIRMED: "confirmed, waiting to be packed",
    PROCESSING: "being packed and prepared for the courier",
    SHIPPED: "handed to the courier and on its way",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
};

const MAX_ABOUT_CHARS = 700;
const MAX_FAQ_ANSWER_CHARS = 300;

function clean(value, limit) {
    const text = String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    return limit && text.length > limit ? `${text.slice(0, limit)}...` : text;
}

// Decimal columns arrive from Prisma as Decimal objects, so coerce before
// formatting or "BDT 80.00" turns into "[object Object]".
function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return `BDT ${number.toFixed(number % 1 === 0 ? 0 : 2)}`;
}

function shortDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

export function dressChartText() {
    return DRESS_SIZE_CHART.map(
        (row) => `${row.size} (bust ${row.bust}", waist ${row.waist}", hip ${row.hip}")`
    ).join("; ");
}

export function shoeChartText() {
    return SHOE_SIZE_CHART.map(
        (row) => `EU ${row.size} = ${row.footLengthCm} cm`
    ).join("; ");
}

/**
 * Build the STORE FACTS block injected into the system prompt.
 *
 * Always includes the size charts (they are small and are exactly what the
 * assistant used to be unable to answer). Everything else is included only
 * when the corresponding row actually exists, so an empty FAQ table does not
 * produce a stray heading.
 */
export function buildStoreKnowledge({ shipping, about, faqs, products, sizes } = {}) {
    const sections = [];

    // Sizes the admin configured in Settings > Sizes are the source of truth
    // for what the store sells; the measurement chart below only fills in
    // numbers for those labels (and falls back to the full chart when the
    // admin list is empty, e.g. before setup).
    const offered = (Array.isArray(sizes) ? sizes : [])
        .map((row) => clean(row?.size ?? row, 20))
        .filter(Boolean);
    const chartRows = offered.length
        ? DRESS_SIZE_CHART.filter((row) =>
              offered.some((size) => size.toLowerCase() === row.size.toLowerCase())
          )
        : DRESS_SIZE_CHART;
    const dressMeasurements = chartRows
        .map((row) => `${row.size} (bust ${row.bust}", waist ${row.waist}", hip ${row.hip}")`)
        .join("; ");
    sections.push(
        [
            "Size information - the only size information this store has:",
            offered.length
                ? `- Clothing sizes the store sells right now (configured by the store admin): ${offered.join(", ")}. A clothing size not on this list is NOT sold in this store.`
                : `- Clothing sizes (inches): ${dressChartText()}.`,
            offered.length && dressMeasurements
                ? `- Clothing measurements (inches) for those sizes: ${dressMeasurements}.`
                : "",
            `- Shoe sizes (for shoes): ${shoeChartText()}.`,
        ]
            .filter(Boolean)
            .join("\n")
    );

    if (shipping) {
        const inside = money(shipping.insideDhaka);
        const outside = money(shipping.outsideDhaka);
        const flat = shipping.oneShippingCost == null ? "" : money(shipping.oneShippingCost);
        const lines = [
            "Delivery charges:",
            inside ? `- Inside Dhaka: ${inside}` : "",
            outside ? `- Outside Dhaka: ${outside}` : "",
            flat ? `- Flat single-charge delivery option: ${flat}` : "",
        ].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join("\n"));
    }

    // The seeded about_us row on this store contains placeholder junk ("//"),
    // so only include content that actually reads like a description.
    const aboutText = clean(about?.content, MAX_ABOUT_CHARS);
    if (aboutText.length >= 20) {
        sections.push(`About the store${about?.title ? ` (${clean(about.title, 120)})` : ""}: ${aboutText}`);
    }

    if (Array.isArray(faqs) && faqs.length) {
        const nameById = new Map(
            (Array.isArray(products) ? products : []).map((p) => [p.id, p.name])
        );
        const rows = faqs
            .map((faq) => {
                const question = clean(faq?.question, 200);
                const answer = clean(faq?.answer, MAX_FAQ_ANSWER_CHARS);
                if (!question || !answer) return "";
                const subject = nameById.get(faq?.productId);
                return `- ${subject ? `[${subject}] ` : ""}Q: ${question} A: ${answer}`;
            })
            .filter(Boolean);
        if (rows.length) sections.push(`Product FAQs:\n${rows.join("\n")}`);
    }

    return sections.join("\n\n");
}

/**
 * Build the ORDERS block for the signed-in customer.
 *
 * Answers "where is my order / how do I track it". Every value here comes from
 * the orders table - this store does not persist courier consignment numbers,
 * hub scans or ETAs (see frontend/COURIER_TRACKING_API_CONTRACT.md), so the
 * block says so explicitly rather than letting the model invent a tracking
 * number.
 */
export function buildOrderKnowledge(orders, { userName, userEmail } = {}) {
    const who = [clean(userName, 80), clean(userEmail, 120)].filter(Boolean).join(" / ");
    const header = who ? `Signed-in customer: ${who}.` : "Signed-in customer.";

    if (!Array.isArray(orders) || orders.length === 0) {
        return [
            header,
            "This customer has NO orders on their account yet. Do not describe, track or imply any existing order. Tell them their account has no orders, and suggest the Chat with Admin option if they think that is wrong or ordered as a guest.",
        ].join("\n");
    }

    const rows = orders.map((order) => {
        const items = (Array.isArray(order.items) ? order.items : [])
            .map((item) => {
                const name = clean(item?.product?.name, 80) || `product #${item?.productId}`;
                const size = item?.size ? ` (size ${clean(item.size, 20)})` : "";
                const qty = Number(item?.quantity) || 1;
                return `${name}${size} x${qty}`;
            })
            .filter(Boolean)
            .join(", ");

        const status = clean(order?.status, 20).toUpperCase();
        const note = ORDER_STATUS_NOTE[status];
        const courier = clean(order?.courierEntry, 40);

        return [
            `- Order #${order?.id}`,
            shortDate(order?.createdAt) ? `placed ${shortDate(order.createdAt)}` : "",
            note ? `status ${status} (${note})` : `status ${status}`,
            `payment ${clean(order?.paymentStatus, 20).toUpperCase() || "unknown"}`,
            money(order?.totalAmount) ? `total ${money(order.totalAmount)}` : "",
            clean(order?.district, 40) ? `shipping to ${clean(order.district, 40)}` : "",
            courier ? `assigned courier: ${courier}` : "no courier assigned yet",
            items ? `items: ${items}` : "",
        ]
            .filter(Boolean)
            .join(", ");
    });

    return [
        header,
        "This customer's own recent orders, newest first:",
        ...rows,
        "",
        `Order statuses move through: ${ORDER_STATUS_FLOW.join(" -> ")}.`,
        "This store does not store courier consignment/tracking numbers, hub scans or delivery ETAs. If a courier is assigned you may name it, but never invent a tracking number, scan event, hub location or delivery date.",
    ].join("\n");
}
