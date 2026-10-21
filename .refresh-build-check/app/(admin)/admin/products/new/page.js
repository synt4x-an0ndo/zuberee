"use client";

import ProductForm from "@/components/admin/ProductForm";
import { AdminHeader } from "@/components/admin/AdminPage";

export default function NewProductPage() {
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Catalogue" title="New product" subtitle="Photos are uploaded after the product is created." />
      <ProductForm mode="create" />
    </div>
  );
}
