import { redirect } from "next/navigation";

export default function OrderInvoiceAlias({ params }) {
  return redirect(`/admin/orders/${params.orderId}`);
}
