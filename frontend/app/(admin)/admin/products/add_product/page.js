"use client";

import ProductForm from "@/components/admin/ProductForm";
import PageGate from "@/components/admin/PageGate";

/** Create product - POST api/products (JSON). */
export default function ProductAddPage() {
  return (
    <PageGate permission="create products">
      <ProductForm />
    </PageGate>
  );
}
