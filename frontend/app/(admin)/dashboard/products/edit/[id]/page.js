"use client";

import { use, useEffect, useState } from "react";
import ProductForm from "@/components/admin/ProductForm";
import PageGate from "@/components/admin/PageGate";
import { api } from "@/lib/api";
import Loader from "@/components/Loader";

/** Edit product - GET api/products/{id}, save via PUT api/products/{id}. */
function EditForm({ id }) {
  const [initial, setInitial] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`api/products/${id}`);
        if (!alive) return;
        const p = r?.data || r;
        setInitial({
          title: p.title || "",
          sku: p.sku || "",
          price: p.price ?? "",
          discount: p.discount ?? "",
          status: String(p.status || "IN_STOCK").toUpperCase().replace("-", "_"),
          short_description: p.short_description || "",
          description: p.description || "",
          video_url: p.video_url || "",
          stock: p.stock ?? p.inventory?.stock ?? "",
          isActive: p.isActive ?? p.is_active ?? true,
          categoryId: p.category?.[0]?.id ?? p.categoryId ?? "",
          categories: (p.category || p.categories || []).map((c) => ({ id: c.id })),
          colors: (p.colors || []).map((c) => ({
            name: c.name || "",
            code: c.code || "",
            image: c.image || "", // keep existing swatch URL
          })),
          sizes: (p.sizes || []).map((s) => ({
            size_id: s.id ?? s.size_id,
            price: s.pivot?.price ?? "",
            stock: s.pivot?.stock ?? "",
          })),
          faqs: (p.faqs || []).map((f) => ({
            question: f.question || "",
            answer: f.answer || "",
          })),
          specifications: (p.specifications || []).map((s) => ({
            key: s.key || "",
            value: s.value || "",
          })),
          images: (p.images || []).map((im) => im.image).filter(Boolean),
        });
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (missing) return <div className="text-center py-5 text-muted">Product not found.</div>;
  if (!initial) return <Loader />;
  return <ProductForm id={id} initial={initial} />;
}

export default function ProductEditPage({ params }) {
  const { id } = use(params);
  return (
    <PageGate permission="edit products">
      <EditForm id={id} />
    </PageGate>
  );
}
