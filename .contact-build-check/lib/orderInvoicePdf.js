/**
 * Premium A4 invoice PDF for a single order — generated in the browser.
 *
 * Data in:  one order from `GET api/admin/orders/:id` (already loaded by the
 *           invoice / order pages). No extra API call, no backend change.
 * jsPDF is imported lazily so it never weighs down the initial bundle.
 * Numbers come from lib/orderInvoice.js, shared with the invoice page.
 */

import { getInvoiceData, invoiceMoney, sanitizePdfText } from "./orderInvoice.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return sanitizePdfText(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  const valid = /^[0-9a-f]{6}$/i.test(clean) ? clean : "b4532a";
  return [parseInt(valid.slice(0, 2), 16), parseInt(valid.slice(2, 4), 16), parseInt(valid.slice(4, 6), 16)];
}
const mixRgb = (a, b, t) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/** Build the PDF document (exported for testing / preview). */
export async function createOrderInvoicePdf({ order, siteName = "Store", primaryColor = "#b4532a", company = {} } = {}) {
  if (!order) throw new Error("The order has not loaded yet.");
  const { jsPDF } = await import("jspdf");
  const inv = getInvoiceData(order);

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
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 16;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BOTTOM = PAGE_H - 18;
  let y = MARGIN;

  doc.setProperties({
    title: `${store} - Invoice ${inv.number}`,
    subject: `Invoice for order ${inv.number}`,
    author: store,
    creator: `${store} admin - Orders`,
    keywords: "invoice, order",
  });

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

  function addPage() {
    doc.addPage();
    fill(brandDeep);
    doc.rect(0, 0, PAGE_W, 11, "F");
    fill(brand);
    doc.rect(0, 11, PAGE_W, 0.7, "F");
    text(store.toUpperCase(), MARGIN, 7.2, { size: 8, style: "bold", color: WHITE, charSpace: 1.1 });
    text(`Invoice ${inv.number}`, PAGE_W - MARGIN, 7.2, { size: 7.5, color: brandSoft, align: "right" });
    y = 19;
  }
  const ensureSpace = (h) => { if (y + h > BOTTOM) addPage(); };

  /* ---------------- header band ---------------- */
  fill(brandDeep);
  doc.rect(0, 0, PAGE_W, 40, "F");
  fill(mixRgb(brandDeep, WHITE, 0.12));
  doc.circle(196, 0, 24, "F");
  doc.circle(196, 0, 16, "F");
  fill(brand);
  doc.rect(0, 40, PAGE_W, 1.4, "F");
  fill(gold);
  doc.rect(0, 41.4, PAGE_W, 0.5, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(19);
  textColor(WHITE);
  doc.setCharSpace(1.6);
  doc.text(store.toUpperCase().slice(0, 22), MARGIN, 15.5);
  doc.setCharSpace(0);
  text("INVOICE", MARGIN, 24, { size: 15, style: "bold", color: WHITE, charSpace: 2.5 });
  const companyBits = [company.address, company.phone, company.email].map(sanitizePdfText).filter(Boolean);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  textColor(brandSoft);
  if (companyBits.length) doc.text(doc.splitTextToSize(companyBits.join("  |  "), 112), MARGIN, 30.5, { lineHeightFactor: 1.4 });

  // Invoice meta card
  const cardX = 128;
  fill(WHITE);
  doc.roundedRect(cardX, 8, 66, 25, 2, 2, "F");
  text("INVOICE NO.", cardX + 5, 14.5, { size: 6.4, style: "bold", color: brand, charSpace: 1.1 });
  text(`#${inv.number}`, cardX + 61, 14.5, { size: 9, style: "bold", color: ink, align: "right" });
  text("Date", cardX + 5, 20, { size: 7.4, color: muted });
  text(prettyDateTime(inv.createdAt), cardX + 61, 20, { size: 7.4, color: ink, align: "right" });
  text("Payment", cardX + 5, 25.5, { size: 7.4, color: muted });
  text(`${inv.paymentMethod}${inv.paymentStatus ? ` (${inv.paymentStatus})` : ""}`.replace(/\b\w/g, (c) => c.toUpperCase()), cardX + 61, 25.5, { size: 7.4, color: ink, align: "right" });
  text("Status", cardX + 5, 31, { size: 7.4, color: muted });
  text(inv.status ? inv.status.replace(/\b\w/g, (c) => c.toUpperCase()) : "-", cardX + 61, 31, { size: 7.4, style: "bold", color: brandDarker, align: "right" });

  y = 50;

  /* ---------------- bill to / order snapshot ---------------- */
  const halfW = (CONTENT_W - 6) / 2;
  fill(brandTint);
  stroke(line);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, y, halfW, 27, 1.6, 1.6, "FD");
  text("BILL TO", MARGIN + 5, y + 6, { size: 6.6, style: "bold", color: brand, charSpace: 1.2 });
  text(inv.customer.name, MARGIN + 5, y + 12, { size: 10.5, style: "bold", color: ink });
  const billParts = [inv.customer.address, inv.customer.district].filter(Boolean);
  if (billParts.length === 2 && billParts[0].toLowerCase().includes(billParts[1].toLowerCase())) billParts.pop();
  const billLines = doc.splitTextToSize(billParts.join(", "), halfW - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  textColor(muted);
  if (billLines.length) doc.text(billLines.slice(0, 2), MARGIN + 5, y + 17.5, { lineHeightFactor: 1.4 });
  if (inv.customer.phone) text(`Phone: ${inv.customer.phone}`, MARGIN + 5, y + 24, { size: 8, color: ink });

  const rightX = MARGIN + halfW + 6;
  fill(WHITE);
  doc.roundedRect(rightX, y, halfW, 27, 1.6, 1.6, "FD");
  text("ORDER SNAPSHOT", rightX + 5, y + 6, { size: 6.6, style: "bold", color: brand, charSpace: 1.2 });
  const snapshot = [
    ["Items", `${inv.items.length} product${inv.items.length === 1 ? "" : "s"} | ${inv.items.reduce((s, i) => s + i.qty, 0)} units`],
    ["Placed", prettyDateTime(inv.createdAt)],
    ["Customer", inv.customer.type || "-"],
    ["Total due", `BDT ${invoiceMoney(inv.totalDue)}`],
  ];
  snapshot.forEach(([label, value], i) => {
    const rowY = y + 11.5 + i * 4.4;
    text(label, rightX + 5, rowY, { size: 7.6, color: muted });
    text(value, rightX + halfW - 5, rowY, { size: 7.6, style: label === "Total due" ? "bold" : "normal", color: label === "Total due" ? brandDarker : ink, align: "right" });
  });
  y += 34;

  /* ---------------- items table ---------------- */
  text("ITEMS", MARGIN, y + 3, { size: 7.5, style: "bold", color: muted, charSpace: 1.1 });
  y += 6;
  const cols = [
    { label: "#", w: 9, align: "center" },
    { label: "Product description", w: 74 },
    { label: "Variant", w: 27 },
    { label: "Qty", w: 13, align: "center" },
    { label: "Unit price", w: 27, align: "right" },
    { label: "Total", w: 28, align: "right" },
  ];
  function tableHeader() {
    fill(brandDeep);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.2, 1.2, "F");
    let x = MARGIN;
    for (const col of cols) {
      const ax = col.align === "right" ? x + col.w - 3 : col.align === "center" ? x + col.w / 2 : x + 3;
      text(col.label.toUpperCase(), ax, y + 5.3, { size: 6.8, style: "bold", color: WHITE, align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left", charSpace: 0.4 });
      x += col.w;
    }
    y += 8;
  }
  tableHeader();

  if (!inv.items.length) {
    fill(zebra);
    doc.rect(MARGIN, y, CONTENT_W, 11, "F");
    text("No items on this order.", PAGE_W / 2, y + 7, { size: 8.5, color: muted, align: "center" });
    y += 14;
  }

  inv.items.forEach((item, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    const titleLines = doc.splitTextToSize(sanitizePdfText(item.title), cols[1].w - 6).slice(0, 3);
    const rowH = Math.max(10.5, titleLines.length * 3.9 + (item.sku ? 6.2 : 3.2));
    if (y + rowH > BOTTOM) {
      addPage();
      text("Items (continued)", MARGIN, y + 3, { size: 8, style: "bold", color: muted });
      y += 6;
      tableHeader();
    }
    const rowY = y;
    if (index % 2 === 1) { fill(zebra); doc.rect(MARGIN, rowY, CONTENT_W, rowH, "F"); }
    stroke(line);
    doc.setLineWidth(0.18);
    doc.line(MARGIN, rowY + rowH, MARGIN + CONTENT_W, rowY + rowH);

    let x = MARGIN;
    const midY = rowY + rowH / 2 + 1.4;
    text(String(index + 1), x + cols[0].w / 2, midY, { size: 8, color: muted, align: "center" });
    x += cols[0].w;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    textColor(ink);
    doc.text(titleLines, x + 3, rowY + 4.6, { lineHeightFactor: 1.25 });
    if (item.sku) text(`SKU: ${item.sku}`, x + 3, rowY + rowH - 2.2, { size: 6.4, color: faint });
    x += cols[1].w;
    text(item.variant || "-", x + 3, midY, { size: 7.8, color: muted });
    x += cols[2].w;
    text(String(item.qty), x + cols[3].w / 2, midY, { size: 8.4, style: "bold", align: "center" });
    x += cols[3].w;
    text(invoiceMoney(item.unitPrice), x + cols[4].w - 3, midY, { size: 8, color: muted, align: "right" });
    x += cols[4].w;
    text(invoiceMoney(item.total), x + cols[5].w - 3, midY, { size: 8.6, style: "bold", color: brandDarker, align: "right" });
    y += rowH;
  });

  /* ---------------- totals ---------------- */
  y += 5;
  ensureSpace(42);
  const totalsX = MARGIN + CONTENT_W - 74;
  const totalsW = 74;
  const rows = [
    ["Subtotal", inv.subtotal, false],
    ...(Math.abs(inv.adjustment) >= 0.005 ? [["Discount / adjustment", inv.adjustment, false]] : []),
    ["Shipping", inv.shipping, false],
    ["Advance payment", -inv.advance, false],
    ["Total", inv.total, true],
  ];
  rows.forEach(([label, value, strong]) => {
    if (strong) {
      fill(brandDeep);
      doc.roundedRect(totalsX, y, totalsW, 10, 1.2, 1.2, "F");
      text(label.toUpperCase(), totalsX + 4, y + 6.6, { size: 8, style: "bold", color: WHITE, charSpace: 0.6 });
      text(`BDT ${invoiceMoney(value)}`, totalsX + totalsW - 4, y + 6.6, { size: 9.5, style: "bold", color: WHITE, align: "right" });
      y += 12.5;
    } else {
      text(label, totalsX + 4, y + 4.5, { size: 8.2, color: muted });
      text(`BDT ${invoiceMoney(value)}`, totalsX + totalsW - 4, y + 4.5, { size: 8.4, color: ink, align: "right" });
      stroke(line);
      doc.setLineWidth(0.18);
      doc.line(totalsX + 4, y + 6.5, totalsX + totalsW - 4, y + 6.5);
      y += 8;
    }
  });
  fill(gold);
  doc.roundedRect(totalsX, y, totalsW, 10, 1.2, 1.2, "F");
  text("TOTAL DUE", totalsX + 4, y + 6.6, { size: 8, style: "bold", color: ink, charSpace: 0.6 });
  text(`BDT ${invoiceMoney(inv.totalDue)}`, totalsX + totalsW - 4, y + 6.6, { size: 9.5, style: "bold", color: ink, align: "right" });
  y += 16;

  // Payment / note block, left of where totals were
  const noteY = y - 16 - rows.length * 0; // visually anchors under table on short invoices
  void noteY;
  ensureSpace(24);
  fill(brandSoft);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 1.6, 1.6, "F");
  fill(brand);
  doc.rect(MARGIN, y, 1.4, 16, "F");
  text(`Payment method: ${inv.paymentMethod}${inv.paymentStatus ? ` | Payment status: ${inv.paymentStatus}` : ""}${inv.courier ? ` | Courier: ${inv.courier}` : ""}`, MARGIN + 5.5, y + 6.2, { size: 8.2, style: "bold", color: ink });
  text(inv.deliveryNotes ? `Delivery note: ${inv.deliveryNotes}` : "Please check your products on delivery. Keep this invoice for any exchange or warranty claim.", MARGIN + 5.5, y + 11.5, { size: 7.8, color: muted });
  y += 22;

  text(`Thank you for shopping with ${store}.`, PAGE_W / 2, y + 2, { size: 9, style: "bold", color: brandDarker, align: "center" });
  y += 6;

  /* ---------------- footer ---------------- */
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    stroke(line);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    text(`${store}  |  Invoice ${inv.number}`, MARGIN, PAGE_H - 8.5, { size: 6.6, color: faint });
    text("This is a computer-generated invoice.", PAGE_W / 2, PAGE_H - 8.5, { size: 6.6, color: faint, align: "center" });
    text(`Page ${page} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8.5, { size: 6.6, color: faint, align: "right" });
  }

  const filename = `${store.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "store"}-invoice-${inv.number.toLowerCase()}.pdf`;
  return { doc, filename, invoice: inv };
}

/** Build the invoice PDF and trigger the browser download. Returns the filename. */
export async function downloadOrderInvoicePdf(options = {}) {
  const { doc, filename } = await createOrderInvoicePdf(options);
  doc.save(filename);
  return filename;
}
