/**
 * Premium, print-ready Sales Report PDF — generated entirely in the browser.
 *
 * Data in:  the exact payload already loaded on the admin Sales report page
 *           (`GET api/admin/sales-report`). No extra API call, no backend change.
 * PDF out:  A4, brand-tinted header, KPI cards, auto insights, daily-sales
 *           chart, order-status mix, top-products ranking, a full
 *           best-selling-products table (Sold products only — never the
 *           zero-sale catalogue dump that made the reference PDF 34 pages),
 *           a daily-sales appendix, and a methodology note.
 *
 * Field names are normalised for both shapes the UI has used:
 * backend (`gross_sales`, `order_count`) and legacy (`sales`, `order_lines`).
 *
 * jsPDF is imported lazily so it never weighs down the initial page bundle.
 */

const BDT = "BDT";

/* ------------------------------------------------------------------ */
/* Small value helpers (kept dependency-free on purpose)               */
/* ------------------------------------------------------------------ */

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const group = (value) => Math.round(num(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (value) => `${BDT} ${group(value)}`;
const count = (value) => group(value);
const percent = (part, total, digits = 1) => (num(total) > 0 ? (num(part) / num(total)) * 100 : 0).toFixed(digits);

/**
 * jsPDF's built-in fonts are WinAnsi — smart quotes, dashes and the taka sign
 * would print as garbage, so transliterate the common ones and drop the rest.
 */
export function sanitizePdfText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/৳/g, BDT)
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10-01" -> "01 Oct 2026" (parsed by hand, so timezones never shift it). */
function prettyDate(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? sanitizePdfText(value) : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }
  return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function weekdayOf(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return WEEKDAYS[date.getUTCDay()] || "";
}

/** Inclusive day count between two YYYY-MM-DD strings (min 1). */
function periodDays(from, to) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 864e5) + 1);
}

function prettyDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function slugify(value) {
  return (
    sanitizePdfText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "store"
  );
}

/* ------------------------------------------------------------------ */
/* Colour helpers (brand colour is mixed locally, like lib/theme.js)   */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  const valid = /^[0-9a-f]{6}$/i.test(clean) ? clean : "b4532a";
  return [parseInt(valid.slice(0, 2), 16), parseInt(valid.slice(2, 4), 16), parseInt(valid.slice(4, 6), 16)];
}

const mixRgb = (a, b, t) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/* ------------------------------------------------------------------ */
/* Report normalisation                                               */
/* ------------------------------------------------------------------ */

function normalizeReport(report) {
  const summary = report?.summary || {};
  const products = (Array.isArray(report?.products) ? report.products : [])
    .map((p) => {
      const units = num(p.quantity_sold ?? p.units_sold ?? p.quantity ?? p.units);
      const sales = num(p.gross_sales ?? p.sales ?? p.revenue);
      const orders = num(p.order_count ?? p.order_lines ?? p.orders);
      return {
        id: p.product_id ?? p.id ?? `${p.title || p.name || "product"}-${p.sku || ""}`,
        title: sanitizePdfText(p.title || p.name) || "Untitled product",
        sku: sanitizePdfText(p.sku),
        units,
        orders,
        sales,
        customers: num(p.customer_count ?? p.customers),
        avgUnitPrice: num(p.average_unit_price) || (units > 0 ? sales / units : 0),
        lastOrderedAt: p.last_ordered_at || null,
      };
    })
    // Premium reports list what actually sold — not the whole catalogue at 0.
    .filter((p) => p.units > 0 || p.sales > 0);

  const daily = (Array.isArray(report?.daily_sales) ? report.daily_sales : []).map((d) => ({
    date: d.date,
    orders: num(d.orders),
    customers: num(d.customers),
    sales: num(d.sales),
  }));

  const statuses = (Array.isArray(report?.status_breakdown) ? report.status_breakdown : []).map((row) => ({
    status: sanitizePdfText(row.status) || "Unknown",
    label: (sanitizePdfText(row.status) || "Unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    orders: num(row.orders),
    sales: num(row.sales),
  }));

  return {
    from: report?.range?.from || "",
    to: report?.range?.to || "",
    timezone: report?.range?.timezone || "Asia/Dhaka",
    grossSales: num(summary.gross_sales ?? summary.sales),
    orders: num(summary.orders),
    unitsSold: num(summary.units_sold ?? summary.units),
    customers: num(summary.customers),
    averageOrderValue: num(summary.average_order_value) || (num(summary.orders) > 0 ? num(summary.gross_sales) / num(summary.orders) : 0),
    shippingCollected: num(summary.shipping_collected),
    productsOrdered: num(summary.products_ordered) || products.length,
    products,
    daily,
    statuses,
  };
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

/** Build the PDF document (exported for testing / preview). */
export async function createSalesReportPdf({ report, siteName = "Store", primaryColor = "#b4532a", company = {}, filters = {} } = {}) {
  if (!report) throw new Error("The sales report has not loaded yet.");

  const { jsPDF } = await import("jspdf");
  const data = normalizeReport(report);
  const brand = hexToRgb(primaryColor);
  const brandDeep = mixRgb(brand, BLACK, 0.52);
  const brandDarker = mixRgb(brand, BLACK, 0.28);
  const brandMid = mixRgb(brand, WHITE, 0.45);
  const brandSoft = mixRgb(brand, WHITE, 0.9);
  const brandTint = mixRgb(brand, WHITE, 0.96);
  const gold = [216, 164, 65];
  const ink = [24, 30, 27];
  const muted = [104, 113, 108];
  const faint = [148, 156, 151];
  const line = [231, 226, 220];
  const zebra = [250, 248, 246];

  const store = sanitizePdfText(siteName) || "Store";
  const generatedAt = new Date();
  const days = periodDays(data.from, data.to);
  const productSalesTotal = data.products.reduce((sum, p) => sum + p.sales, 0);
  const productUnitsTotal = data.products.reduce((sum, p) => sum + p.units, 0);
  const productOrdersTotal = data.products.reduce((sum, p) => sum + p.orders, 0);
  const topProduct = data.products[0] || null;
  const bestDay = data.daily.reduce((best, d) => (d.sales > (best?.sales ?? -1) ? d : best), null);
  const statusOrdersTotal = data.statuses.reduce((sum, s) => sum + s.orders, 0);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 16;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BOTTOM = PAGE_H - 18;
  let y = MARGIN;

  doc.setProperties({
    title: `${store} - Sales Report (${data.from} to ${data.to})`,
    subject: "Sales report",
    author: store,
    creator: `${store} admin - Sales report`,
    keywords: "sales report, orders, products, revenue",
  });

  /* ---------------- drawing primitives ---------------- */

  const fill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const stroke = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const textColor = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  function text(value, x, yy, { size = 9, style = "normal", color = ink, align = "left", charSpace = 0 } = {}) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    textColor(color);
    doc.setCharSpace(charSpace);
    doc.text(sanitizePdfText(value), x, yy, { align });
    doc.setCharSpace(0);
  }

  /** Add a page with a slim continuation header (every page after the first). */
  function addPage() {
    doc.addPage();
    y = MARGIN;
    fill(brandDeep);
    doc.rect(0, 0, PAGE_W, 11, "F");
    fill(brand);
    doc.rect(0, 11, PAGE_W, 0.7, "F");
    text(store.toUpperCase(), MARGIN, 7.2, { size: 8, style: "bold", color: WHITE, charSpace: 1.1 });
    text(`Sales report  |  ${prettyDate(data.from)} - ${prettyDate(data.to)}`, PAGE_W - MARGIN, 7.2, { size: 7.5, color: brandSoft, align: "right" });
    y = 19;
  }

  function ensureSpace(heightNeeded) {
    if (y + heightNeeded > BOTTOM) addPage();
  }

  function sectionHeading(number, title, subtitle) {
    ensureSpace(subtitle ? 17 : 13);
    fill(brand);
    doc.circle(MARGIN + 3.2, y + 3.2, 3.2, "F");
    text(number, MARGIN + 3.2, y + 4.6, { size: 7.5, style: "bold", color: WHITE, align: "center" });
    text(title.toUpperCase(), MARGIN + 9.5, y + 5.4, { size: 10.5, style: "bold", color: ink, charSpace: 0.7 });
    if (subtitle) text(subtitle, MARGIN + 9.5, y + 10.4, { size: 7.8, color: muted });
    y += subtitle ? 14.5 : 11;
  }

  function tableHeader(columns) {
    ensureSpace(10);
    fill(brandDeep);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.2, 1.2, "F");
    let x = MARGIN;
    for (const col of columns) {
      const alignX = col.align === "right" ? x + col.w - 3 : col.align === "center" ? x + col.w / 2 : x + 3;
      text(col.label.toUpperCase(), alignX, y + 5.3, { size: 7, style: "bold", color: WHITE, align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left", charSpace: 0.4 });
      x += col.w;
    }
    y += 8;
  }

  /* ---------------- cover header ---------------- */

  fill(brandDeep);
  doc.rect(0, 0, PAGE_W, 47, "F");
  fill(mixRgb(brandDeep, WHITE, 0.12));
  doc.circle(196, 2, 26, "F");
  doc.circle(196, 2, 18, "F");
  fill(brand);
  doc.rect(0, 47, PAGE_W, 1.6, "F");
  fill(gold);
  doc.rect(0, 48.6, PAGE_W, 0.5, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(19);
  textColor(WHITE);
  doc.setCharSpace(1.6);
  doc.text(store.toUpperCase().slice(0, 22), MARGIN, 15.5);
  doc.setCharSpace(0);
  text("COMMERCE INTELLIGENCE", MARGIN, 21.5, { size: 7, style: "bold", color: brandMid, charSpace: 2 });
  text("Sales report", MARGIN, 32, { size: 25, style: "bold", color: WHITE });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  textColor(brandSoft);
  doc.text(doc.splitTextToSize("See exactly what customers ordered, how often they ordered it - and where sales came from.", 108), MARGIN, 37.5, { lineHeightFactor: 1.35 });
  text(`Status filter: ${sanitizePdfText(filters.statusLabel) || "All statuses"}   |   Product search: ${sanitizePdfText(filters.product) || "All products"}   |   Sorted by: ${sanitizePdfText(filters.sortLabel) || "Sales value"}`, MARGIN, 44.6, { size: 6.8, color: brandMid });

  // Period card
  const cardX = 132;
  fill(WHITE);
  doc.roundedRect(cardX, 9.5, 62, 29, 2, 2, "F");
  text("REPORT PERIOD", cardX + 5, 16, { size: 6.5, style: "bold", color: brand, charSpace: 1.4 });
  text(`${prettyDate(data.from)}  -  ${prettyDate(data.to)}`, cardX + 5, 22.5, { size: 9.5, style: "bold", color: ink });
  text(`${days} day${days === 1 ? "" : "s"}  |  ${data.timezone}`, cardX + 5, 27.5, { size: 7.5, color: muted });
  text(`Generated ${prettyDateTime(generatedAt)}`, cardX + 5, 32.5, { size: 7, color: faint });
  if (company?.email || company?.phone) {
    text([company.email, company.phone].filter(Boolean).join("  |  "), cardX + 5, 36.8, { size: 6.5, color: faint });
  }

  y = 57;

  /* ---------------- KPI cards ---------------- */

  const kpis = [
    { label: "Gross sales", value: money(data.grossSales), hint: "Excluding cancelled orders", rgb: brand },
    { label: "Orders", value: count(data.orders), hint: `${(data.orders / days).toFixed(1)} orders per day`, rgb: mixRgb(brand, [28, 110, 140], 0.45) },
    { label: "Units sold", value: count(data.unitsSold), hint: `${count(data.productsOrdered)} products ordered`, rgb: mixRgb(brand, [34, 128, 84], 0.45) },
    { label: "Customers", value: count(data.customers), hint: "Unique buyers in period", rgb: mixRgb(brand, gold, 0.4) },
  ];
  const kpiW = (CONTENT_W - 9) / 4;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + 3);
    fill(WHITE);
    stroke(line);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, kpiW, 23, 1.6, 1.6, "FD");
    fill(kpi.rgb);
    doc.roundedRect(x, y, kpiW, 1.8, 0.8, 0.8, "F");
    doc.rect(x, y + 1, kpiW, 1, "F");
    text(kpi.label, x + 4, y + 8.5, { size: 6.6, style: "bold", color: muted, charSpace: 0.9 });
    text(kpi.value, x + 4, y + 16, { size: kpi.value.length > 13 ? 11.5 : 14, style: "bold", color: ink });
    text(kpi.hint, x + 4, y + 20.5, { size: 6.4, color: faint });
  });
  y += 28;

  /* ---------------- secondary metrics strip ---------------- */

  const secondary = [
    { label: "Avg. order value", value: money(data.averageOrderValue) },
    { label: "Shipping collected", value: money(data.shippingCollected) },
    { label: "Products ordered", value: count(data.productsOrdered) },
    { label: "Best single day", value: bestDay ? money(bestDay.sales) : "-" },
  ];
  fill(brandTint);
  stroke(line);
  doc.roundedRect(MARGIN, y, CONTENT_W, 13, 1.6, 1.6, "FD");
  secondary.forEach((item, i) => {
    const x = MARGIN + (CONTENT_W / 4) * i;
    if (i > 0) {
      stroke(line);
      doc.setLineWidth(0.25);
      doc.line(x, y + 2.5, x, y + 10.5);
    }
    text(item.label.toUpperCase(), x + 5, y + 5.4, { size: 6.2, style: "bold", color: muted, charSpace: 0.5 });
    text(item.value, x + 5, y + 10.6, { size: 9.5, style: "bold", color: brandDarker });
  });
  y += 19;

  /* ---------------- 01 executive snapshot ---------------- */

  sectionHeading("01", "Executive snapshot", "Auto-generated from the figures above - the story of this period in three lines.");

  const insights = [];
  if (topProduct) {
    insights.push(
      `Best seller: "${topProduct.title}" generated ${money(topProduct.sales)} (${percent(topProduct.sales, productSalesTotal)}% of product sales) from ${count(topProduct.units)} unit${topProduct.units === 1 ? "" : "s"} across ${count(topProduct.orders)} order line${topProduct.orders === 1 ? "" : "s"}.`
    );
  }
  if (bestDay) {
    insights.push(
      `Peak day: ${weekdayOf(bestDay.date)} ${prettyDate(bestDay.date)} was the strongest day with ${money(bestDay.sales)} across ${count(bestDay.orders)} order${bestDay.orders === 1 ? "" : "s"}.`
    );
  }
  insights.push(
    data.orders > 0
      ? `Pace: ${money(data.grossSales)} over ${days} day${days === 1 ? "" : "s"} averages ${money(data.grossSales / days)} per day, at an average order value of ${money(data.averageOrderValue)} from ${count(data.customers)} customer${data.customers === 1 ? "" : "s"}.`
      : "No completed sales were recorded in this period. Try a wider date range or a different order status."
  );

  const insightLines = insights.flatMap((line) => doc.splitTextToSize(`-  ${sanitizePdfText(line)}`, CONTENT_W - 12));
  const insightH = Math.max(15, insightLines.length * 4.4 + 5);
  ensureSpace(insightH + 4);
  fill(brandSoft);
  doc.roundedRect(MARGIN, y, CONTENT_W, insightH, 1.6, 1.6, "F");
  fill(brand);
  doc.rect(MARGIN, y, 1.4, insightH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  textColor(ink);
  doc.text(insightLines, MARGIN + 5.5, y + 6.2, { lineHeightFactor: 1.45 });
  y += insightH + 7;

  /* ---------------- 02 sales trend ---------------- */

  sectionHeading("02", "Sales trend", data.daily.length ? `Daily gross sales, ${prettyDate(data.from)} - ${prettyDate(data.to)}.` : "No daily sales to chart in this period.");

  if (data.daily.length) {
    const chartH = 34;
    const chartY = y + chartH; // baseline
    ensureSpace(chartH + 12);
    const maxSales = Math.max(...data.daily.map((d) => d.sales), 1);
    const plotW = CONTENT_W - 8;
    const slot = plotW / data.daily.length;
    const barW = Math.min(11, Math.max(1.6, slot * 0.62));

    stroke(line);
    doc.setLineWidth(0.3);
    doc.line(MARGIN + 4, y, MARGIN + 4, chartY);
    doc.line(MARGIN + 4, chartY, MARGIN + 4 + plotW, chartY);
    text(money(maxSales), MARGIN + 2, y + 1.5, { size: 6.2, color: faint });
    data.daily.forEach((d, i) => {
      const h = Math.max(d.sales > 0 ? 1.2 : 0, (d.sales / maxSales) * (chartH - 5));
      const x = MARGIN + 4 + slot * i + (slot - barW) / 2;
      fill(d === bestDay ? gold : brand);
      if (h > 0) doc.roundedRect(x, chartY - h, barW, h, 0.5, 0.5, "F");
    });
    const first = data.daily[0];
    const mid = data.daily[Math.floor(data.daily.length / 2)];
    const last = data.daily[data.daily.length - 1];
    text(prettyDate(first.date), MARGIN + 4, chartY + 4.5, { size: 6.4, color: muted });
    if (mid && mid !== first && mid !== last) text(prettyDate(mid.date), MARGIN + 4 + plotW / 2, chartY + 4.5, { size: 6.4, color: muted, align: "center" });
    text(prettyDate(last.date), MARGIN + 4 + plotW, chartY + 4.5, { size: 6.4, color: muted, align: "right" });
    y = chartY + 9;
  }

  /* -------- order status + top 5, side by side -------- */

  const halfW = (CONTENT_W - 6) / 2;
  const colTop = y;
  let leftY = colTop;
  let rightY = colTop;

  // Left: order status mix
  text("ORDER STATUS MIX", MARGIN, leftY + 3, { size: 7.5, style: "bold", color: muted, charSpace: 0.8 });
  leftY += 7;
  if (!data.statuses.length) {
    text("No orders in this period.", MARGIN, leftY + 3, { size: 8, color: faint });
    leftY += 7;
  }
  for (const row of data.statuses.slice(0, 6)) {
    fill(WHITE);
    stroke(line);
    doc.setLineWidth(0.22);
    doc.roundedRect(MARGIN, leftY, halfW, 10.5, 1.2, 1.2, "FD");
    text(row.label, MARGIN + 3.5, leftY + 4.3, { size: 7.8, style: "bold", color: ink });
    text(`${count(row.orders)} order${row.orders === 1 ? "" : "s"}  |  ${money(row.sales)}`, MARGIN + halfW - 3.5, leftY + 4.3, { size: 7, color: muted, align: "right" });
    fill(brandSoft);
    doc.roundedRect(MARGIN + 3.5, leftY + 6.3, halfW - 7, 2.2, 1, 1, "F");
    fill(brand);
    const w = Math.max(0, ((halfW - 7) * num(row.orders)) / Math.max(statusOrdersTotal, 1));
    if (w > 0) doc.roundedRect(MARGIN + 3.5, leftY + 6.3, w, 2.2, 1, 1, "F");
    leftY += 13;
  }

  // Right: top 5 products
  const rightX = MARGIN + halfW + 6;
  text("TOP 5 PRODUCTS BY SALES", rightX, rightY + 3, { size: 7.5, style: "bold", color: muted, charSpace: 0.8 });
  rightY += 7;
  if (!data.products.length) {
    text("No product sales in this period.", rightX, rightY + 3, { size: 8, color: faint });
    rightY += 7;
  }
  data.products.slice(0, 5).forEach((p, i) => {
    fill(i % 2 ? zebra : WHITE);
    doc.roundedRect(rightX, rightY, halfW, 10.5, 1.2, 1.2, "F");
    fill(i === 0 ? gold : brandSoft);
    doc.circle(rightX + 5.5, rightY + 5.2, 3, "F");
    text(String(i + 1), rightX + 5.5, rightY + 6.6, { size: 7, style: "bold", color: i === 0 ? ink : brandDarker, align: "center" });
    const titleParts = doc.splitTextToSize(p.title, halfW - 38);
    const topTitle = titleParts.length > 1 ? `${(titleParts[0] || "").replace(/[\s,;:-]+$/, "")}...` : titleParts[0] || p.title;
    text(topTitle, rightX + 10.5, rightY + 4.4, { size: 7.6, style: "bold", color: ink });
    text(`${count(p.units)} units  |  ${percent(p.sales, productSalesTotal)}% of product sales`, rightX + 10.5, rightY + 8.3, { size: 6.6, color: faint });
    text(money(p.sales), rightX + halfW - 3.5, rightY + 6.4, { size: 8.2, style: "bold", color: brandDarker, align: "right" });
    rightY += 13;
  });

  y = Math.max(leftY, rightY) + 5;

  /* ---------------- 03 product performance table ---------------- */

  sectionHeading("03", "Best-selling products", "Every product that sold in this period, in report order. Zero-sale products are intentionally omitted.");

  const columns = [
    { label: "#", w: 9, align: "center" },
    { label: "Product", w: 69 },
    { label: "Orders", w: 17, align: "right" },
    { label: "Units", w: 15, align: "right" },
    { label: "Avg. price", w: 24, align: "right" },
    { label: "Sales", w: 24, align: "right" },
    { label: "Share", w: 20, align: "right" },
  ];
  tableHeader(columns);

  if (!data.products.length) {
    fill(zebra);
    doc.rect(MARGIN, y, CONTENT_W, 12, "F");
    text("No product sales in this period.", PAGE_W / 2, y + 7.5, { size: 8.5, color: muted, align: "center" });
    y += 16;
  }

  const rankFills = [gold, [192, 198, 204], [222, 178, 138]];
  data.products.forEach((p, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const titleLines = doc.splitTextToSize(p.title, columns[1].w - 6).slice(0, 3);
    const rowH = Math.max(10.5, titleLines.length * 3.9 + (p.sku ? 6.4 : 3.4));
    if (y + rowH > BOTTOM) {
      addPage();
      text("Best-selling products (continued)", MARGIN, y + 3, { size: 8, style: "bold", color: muted });
      y += 6;
      tableHeader(columns);
    }
    const rowY = y;
    if (index % 2 === 1) {
      fill(zebra);
      doc.rect(MARGIN, rowY, CONTENT_W, rowH, "F");
    }
    stroke(line);
    doc.setLineWidth(0.18);
    doc.line(MARGIN, rowY + rowH, MARGIN + CONTENT_W, rowY + rowH);

    let x = MARGIN;
    fill(rankFills[index] || brandSoft);
    doc.circle(x + columns[0].w / 2, rowY + rowH / 2, 3, "F");
    text(String(index + 1), x + columns[0].w / 2, rowY + rowH / 2 + 1.35, { size: 7, style: "bold", color: index < 3 ? ink : brandDarker, align: "center" });
    x += columns[0].w;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    textColor(ink);
    doc.text(titleLines, x + 3, rowY + 4.6, { lineHeightFactor: 1.25 });
    if (p.sku) text(`SKU: ${p.sku}`, x + 3, rowY + rowH - 2.2, { size: 6.4, color: faint });
    x += columns[1].w;

    const midY = rowY + rowH / 2 + 1.4;
    text(count(p.orders), x + columns[2].w - 3, midY, { size: 8.2, align: "right" });
    x += columns[2].w;
    text(count(p.units), x + columns[3].w - 3, midY, { size: 8.2, style: "bold", align: "right" });
    x += columns[3].w;
    text(money(p.avgUnitPrice), x + columns[4].w - 3, midY, { size: 7.8, color: muted, align: "right" });
    x += columns[4].w;
    text(money(p.sales), x + columns[5].w - 3, midY, { size: 8.4, style: "bold", color: brandDarker, align: "right" });
    x += columns[5].w;
    // share, with a slim bar beneath the percentage
    text(`${percent(p.sales, productSalesTotal)}%`, x + columns[6].w - 3, rowY + rowH / 2 - 0.4, { size: 7.8, align: "right" });
    fill(brandSoft);
    doc.rect(x + 3, rowY + rowH / 2 + 1.2, columns[6].w - 6, 1.6, "F");
    fill(brand);
    const shareW = Math.max(0, ((columns[6].w - 6) * p.sales) / Math.max(topProduct?.sales || 0, 1));
    if (shareW > 0) doc.rect(x + 3, rowY + rowH / 2 + 1.2, shareW, 1.6, "F");

    y += rowH;
  });

  if (data.products.length) {
    ensureSpace(12);
    fill(brandDeep);
    doc.roundedRect(MARGIN, y + 1, CONTENT_W, 9.5, 1.2, 1.2, "F");
    let x = MARGIN;
    text("LISTED PRODUCTS TOTAL", x + 3, y + 7, { size: 7.4, style: "bold", color: WHITE, charSpace: 0.5 });
    x += columns[0].w + columns[1].w;
    text(count(productOrdersTotal), x + columns[2].w - 3, y + 7, { size: 8.4, style: "bold", color: WHITE, align: "right" });
    x += columns[2].w;
    text(count(productUnitsTotal), x + columns[3].w - 3, y + 7, { size: 8.4, style: "bold", color: WHITE, align: "right" });
    x += columns[3].w + columns[4].w;
    text(money(productSalesTotal), x + columns[5].w - 3, y + 7, { size: 8.6, style: "bold", color: WHITE, align: "right" });
    y += 15.5;
  }

  /* ---------------- 04 daily sales appendix ---------------- */

  if (data.daily.length) {
    sectionHeading("04", "Daily sales detail", "One row per day with completed sales in this period.");
    const dailyCols = [
      { label: "Date", w: 44 },
      { label: "Day", w: 26 },
      { label: "Orders", w: 30, align: "right" },
      { label: "Customers", w: 32, align: "right" },
      { label: "Sales", w: 46, align: "right" },
    ];
    tableHeader(dailyCols);
    data.daily.forEach((d, index) => {
      const rowH = 8.6;
      if (y + rowH > BOTTOM) {
        addPage();
        text("Daily sales detail (continued)", MARGIN, y + 3, { size: 8, style: "bold", color: muted });
        y += 6;
        tableHeader(dailyCols);
      }
      if (index % 2 === 1) {
        fill(zebra);
        doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
      }
      stroke(line);
      doc.setLineWidth(0.18);
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
      let x = MARGIN;
      text(prettyDate(d.date), x + 3, y + 5.6, { size: 8, style: d === bestDay ? "bold" : "normal", color: ink });
      if (d === bestDay) text("PEAK", x + 34, y + 5.6, { size: 6, style: "bold", color: mixRgb(gold, BLACK, 0.25) });
      x += dailyCols[0].w;
      text(weekdayOf(d.date), x + 3, y + 5.6, { size: 8, color: muted });
      x += dailyCols[1].w;
      text(count(d.orders), x + dailyCols[2].w - 3, y + 5.6, { size: 8.2, align: "right" });
      x += dailyCols[2].w;
      text(count(d.customers), x + dailyCols[3].w - 3, y + 5.6, { size: 8.2, align: "right" });
      x += dailyCols[3].w;
      text(money(d.sales), x + dailyCols[4].w - 3, y + 5.6, { size: 8.4, style: "bold", color: brandDarker, align: "right" });
      y += rowH;
    });
    y += 6;
  }

  /* ---------------- notes ---------------- */

  sectionHeading("05", "Notes & methodology", "How these numbers are calculated, so the report can be trusted and re-checked.");
  const notes = [
    `Source: ${store} admin sales report for ${prettyDate(data.from)} - ${prettyDate(data.to)} (${data.timezone}), status filter "${sanitizePdfText(filters.statusLabel) || "All statuses"}"${filters.product ? `, product search "${sanitizePdfText(filters.product)}"` : ""}.`,
    "Cancelled orders are excluded from gross sales, units sold, product performance and the daily trend. The order-status mix counts every order in the period, including cancelled.",
    "Product sales are order-line totals (unit price x quantity). Gross sales is the order total, so the two can differ where shipping or discounts apply.",
    "Only products that actually sold in the period are listed - unlike a full catalogue export, there are no zero-sale rows.",
    "Confidential: prepared for internal business use only.",
  ];
  const noteLines = notes.flatMap((note) => doc.splitTextToSize(`-  ${note}`, CONTENT_W - 10));
  const notesH = noteLines.length * 4.2 + 6;
  ensureSpace(notesH + 4);
  fill(zebra);
  stroke(line);
  doc.setLineWidth(0.22);
  doc.roundedRect(MARGIN, y, CONTENT_W, notesH, 1.6, 1.6, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  textColor(muted);
  doc.text(noteLines, MARGIN + 5, y + 5.6, { lineHeightFactor: 1.42 });
  y += notesH + 6;

  if (company?.address) {
    text(sanitizePdfText(company.address), PAGE_W / 2, y + 2, { size: 7, color: faint, align: "center" });
  }

  /* ---------------- footer on every page ---------------- */

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    stroke(line);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    text(`${store}  |  Sales report  |  ${prettyDate(data.from)} - ${prettyDate(data.to)}`, MARGIN, PAGE_H - 8.5, { size: 6.6, color: faint });
    text("Confidential - internal use only", PAGE_W / 2, PAGE_H - 8.5, { size: 6.6, color: faint, align: "center" });
    text(`Page ${page} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8.5, { size: 6.6, color: faint, align: "right" });
  }

  const filename = `${slugify(store)}-sales-report-${data.from || "from"}-to-${data.to || "to"}.pdf`;
  return { doc, filename };
}

/**
 * Build the PDF and trigger the browser download.
 * Returns the generated filename.
 */
export async function downloadSalesReportPdf(options = {}) {
  const { doc, filename } = await createSalesReportPdf(options);
  doc.save(filename);
  return filename;
}
