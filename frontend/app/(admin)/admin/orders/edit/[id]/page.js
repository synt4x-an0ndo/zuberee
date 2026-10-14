import { redirect } from "next/navigation";

export default function OrderEditAlias({ params }) {
  return redirect(`/admin/orders/${params.id}`);
}
