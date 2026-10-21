"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FiArrowLeft, FiDownload, FiEdit2, FiPrinter } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import Img from "@/components/Img";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";
import { courierLabel } from "@/lib/couriers";
import { formatDateTime, orderStatusMeta, paymentStatusMeta } from "@/lib/format";
import { getInvoiceData, invoiceMoney } from "@/lib/orderInvoice";
import { downloadOrderInvoicePdf } from "@/lib/orderInvoicePdf";
import { useAsync } from "@/lib/useAsync";

const tk = (value) => `৳${invoiceMoney(value)}`;

/**
 * Invoice page (Zuberee-style): on-screen printable invoice for one order,
 * plus a premium PDF download. Print CSS in globals.css hides the admin
 * shell so Print -> Save as PDF produces the clean sheet only.
 */
export default function AdminOrderInvoicePage() {
  const { orderId } = useParams();
  const { toast } = useFeedback();
  const { siteName, primaryColor, company, logoSizes } = useSite();
  const { data: order, loading, error, reload } = useAsync(() => api.get(`api/admin/orders/${orderId}`).then((b) => b.data), [orderId]);
  const [downloading, setDownloading] = useState(false);

  if (loading) {
    return <div className="stack"><Skeleton style={{ height: 40, width: 260 }} /><Skeleton style={{ height: 520 }} /></div>;
  }
  if (error || !order) {
    return <ErrorState message={error || "Order not found."} onRetry={reload} />;
  }

  const inv = getInvoiceData(order);
  const st = orderStatusMeta(inv.status);
  const pay = paymentStatusMeta(inv.paymentStatus);
  const store = siteName || "Store";

  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const filename = await downloadOrderInvoicePdf({ order, siteName: store, primaryColor, company });
      toast.success(`Invoice downloaded (${filename}).`);
    } catch (err) {
      console.error("Invoice PDF failed:", err);
      toast.error("The invoice PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="no-print">
        <Link href={`/admin/orders/${orderId}`} className="link-arrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FiArrowLeft aria-hidden="true" /> Back to order
        </Link>
      </div>

      <div className="no-print">
        <AdminHeader
          eyebrow="Orders"
          title={`Invoice ${inv.number}`}
          subtitle={`Generated from order #${inv.id} · ${formatDateTime(inv.createdAt)}`}
          actions={(
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button as={Link} href={`/admin/orders/edit/${orderId}`} variant="outline" icon={FiEdit2}>Edit order</Button>
              <Button type="button" variant="outline" icon={FiDownload} loading={downloading} onClick={downloadPdf}>Download PDF</Button>
              <Button type="button" variant="primary" icon={FiPrinter} onClick={() => window.print()}>Print Invoice</Button>
            </div>
          )}
        />
      </div>

      <Card className="invoice-sheet" >
        <div className="invoice-content">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 10 }}>
              {company.logo ? (
                <Img src={company.logo} alt={store} width={logoSizes.invoice.width} height={logoSizes.invoice.height} style={{ width: logoSizes.invoice.width, height: logoSizes.invoice.height, objectFit: "contain" }} className="invoice-logo-img" priority />
              ) : (
                <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "2rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--brand, #b4532a)", textTransform: "uppercase", lineHeight: 1 }}>
                  {store}
                </span>
              )}
              <strong style={{ fontSize: "1.35rem", letterSpacing: "0.14em" }}>INVOICE</strong>
              <div className="muted" style={{ display: "grid", gap: 4 }}>
                {company.address && <span>{company.address}</span>}
                {company.phone && <span>Phone: {company.phone}</span>}
                {company.email && <span>Email: {company.email}</span>}
              </div>
            </div>

            <dl className="invoice-details" style={{ margin: 0, display: "grid", gap: 7 }}>
              <dt style={{ fontSize: "1.05rem", fontWeight: 700 }}>Invoice Details</dt>
              <dd style={{ margin: 0 }}><span className="muted" style={{ fontWeight: 600 }}>Invoice No:</span> <strong className="num">#{inv.number}</strong></dd>
              <dd style={{ margin: 0 }}><span className="muted" style={{ fontWeight: 600 }}>Date:</span> {formatDateTime(inv.createdAt)}</dd>
              <dd style={{ margin: 0 }}><span className="muted" style={{ fontWeight: 600 }}>Payment Method:</span> <span style={{ textTransform: "capitalize" }}>{inv.paymentMethod || "cash"}</span></dd>
              <dd style={{ margin: 0, display: "flex", gap: 6, justifyContent: "flex-end" }}><Badge tone={st.tone}>{st.label}</Badge><Badge tone={pay.tone}>{pay.label}</Badge></dd>
            </dl>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "1.5rem 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            <section>
              <h2 style={{ fontSize: "1rem", margin: "0 0 10px", borderBottom: "1px solid var(--line)", paddingBottom: 8, maxWidth: 420 }}>Bill To:</h2>
              <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{inv.customer.name || "Guest"}</p>
              <p className="muted" style={{ margin: "0 0 4px", lineHeight: 1.55 }}>
                {inv.customer.address}
                {inv.customer.district ? <><br />{inv.customer.district}</> : null}
              </p>
              {inv.customer.phone && <p className="muted num" style={{ margin: 0 }}>Phone: {inv.customer.phone}</p>}
              {inv.customer.email && <p className="muted" style={{ margin: "4px 0 0" }}>Email: {inv.customer.email}</p>}
            </section>
            <section>
              <h2 style={{ fontSize: "1rem", margin: "0 0 10px" }}>Order snapshot</h2>
              <dl className="summary-dl" style={{ display: "grid", gap: 8, margin: 0, maxWidth: 420 }}>
                <div className="summary-row"><dt>Order</dt><dd className="num">{inv.number} (#{inv.id})</dd></div>
                <div className="summary-row"><dt>Placed</dt><dd>{formatDateTime(inv.createdAt)}</dd></div>
                <div className="summary-row"><dt>Items</dt><dd className="num">{inv.items.length} products · {inv.items.reduce((sum, item) => sum + item.qty, 0)} units</dd></div>
                {inv.courier && <div className="summary-row"><dt>Courier</dt><dd>{courierLabel(inv.courier)}</dd></div>}
                <div className="summary-row"><dt>Total due</dt><dd className="num"><strong>{tk(inv.totalDue)}</strong></dd></div>
              </dl>
            </section>
          </div>
        </div>

        <div style={{ padding: "1.5rem 2rem 0" }}>
          <DataTable>
            <thead>
              <tr><th>#</th><th>Product Description</th><th>Variant</th><th className="text-right">Qty</th><th className="text-right">Unit Price</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {inv.items.map((item, index) => (
                <tr key={item.key}>
                  <td className="num">{index + 1}</td>
                  <td><strong>{item.title}</strong>{item.sku && <span className="muted num" style={{ display: "block", fontSize: "0.82rem" }}>{item.sku}</span>}</td>
                  <td className="muted">{item.size ? `Size: ${item.size}` : item.variant || "—"}</td>
                  <td className="text-right num">{item.qty}</td>
                  <td className="text-right num">{tk(item.unitPrice)}</td>
                  <td className="text-right num"><strong>{tk(item.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>

        <div style={{ padding: "1.25rem 2rem 2rem", display: "flex", justifyContent: "flex-end" }}>
          <dl className="summary-dl" style={{ display: "grid", gap: 9, margin: 0, width: "min(360px, 100%)" }}>
            <div className="summary-row"><dt>Subtotal</dt><dd className="num">{tk(inv.subtotal)}</dd></div>
            {Math.abs(inv.adjustment) >= 0.005 && <div className="summary-row"><dt>Discount / adjustment</dt><dd className="num">{tk(inv.adjustment)}</dd></div>}
            <div className="summary-row"><dt>Shipping</dt><dd className="num">{tk(inv.shipping)}</dd></div>
            <div className="summary-row"><dt>Advance Payment</dt><dd className="num">-{tk(inv.advance)}</dd></div>
            <div className="summary-row"><dt>Total</dt><dd className="num"><strong>{tk(inv.total)}</strong></dd></div>
            <div className="summary-row summary-total" style={{ borderTop: "2px solid var(--brand)", paddingTop: 10 }}>
              <dt><strong>Total Due</strong></dt><dd className="num" style={{ fontSize: "1.12rem" }}><strong>{tk(inv.totalDue)}</strong></dd>
            </div>
          </dl>
        </div>

        <footer style={{ borderTop: "1px solid var(--line)", padding: "1.25rem 2rem 1.75rem", display: "grid", gap: 6 }}>
          {inv.deliveryNotes && <p style={{ margin: 0 }}><strong>Delivery note:</strong> {inv.deliveryNotes}</p>}
          <p className="muted" style={{ margin: 0 }}>Please check your products on delivery and keep this invoice for any exchange or warranty claim.</p>
          <p style={{ margin: 0, fontWeight: 700 }}>Thank you for shopping with {store}.</p>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>This is a computer-generated invoice from the {store} admin panel.</p>
        </footer>
      </Card>
    </div>
  );
}
