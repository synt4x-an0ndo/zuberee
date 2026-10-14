import { redirect } from "next/navigation";

export default function ProductEditAlias({ params }) {
  return redirect(`/admin/products/${params.id}`);
}
