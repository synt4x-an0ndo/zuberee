"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import ProductForm, { productToForm } from "@/components/admin/ProductForm";
import { AdminHeader } from "@/components/admin/AdminPage";
import { ErrorState, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

export default function EditProductPage() {
  const { id } = useParams();
  const { data: raw, loading, error, reload } = useAsync(() => api.get(`api/products/${id}`, { auth: false }).then((b) => b.data), [id]);
  const initial = useMemo(() => (raw ? productToForm(raw) : null), [raw]);

  if (loading) return <div className="stack"><Skeleton style={{ height: 40, width: 260 }} /><Skeleton style={{ height: 480 }} /></div>;
  if (error || !raw) return <ErrorState message={error || "Product not found."} onRetry={reload} />;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Catalogue" title={raw.title || raw.name} subtitle={`Product #${id}`} />
      <ProductForm key={id} mode="edit" productId={id} initial={initial} />
    </div>
  );
}
