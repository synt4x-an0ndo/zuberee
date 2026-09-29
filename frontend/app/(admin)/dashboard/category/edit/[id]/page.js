"use client";

import { use, useEffect, useState } from "react";
import CategoryForm from "@/components/admin/CategoryForm";
import PageGate from "@/components/admin/PageGate";
import { api } from "@/lib/api";
import Loader from "@/components/Loader";

/**
 * Edit collection - GET + PUT api/categories/{id}
 */
function EditForm({ id }) {
  const [initial, setInitial] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`api/categories/${id}`);
        if (!alive) return;
        const c = r?.data && typeof r.data === "object" && !Array.isArray(r.data) ? r.data : r;
        setInitial({
          name: c.name || "",
          parent_id: c.parent_id ?? "",
          home_category: c.home_category ? "1" : "0",
          priority: c.priority ?? 0,
          size_guide_type: c.size_guide_type ?? "",
          track_inventory: !!c.track_inventory,
        });
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (missing)
    return (
      <div className="text-center py-5 text-muted">Category not found.</div>
    );
  if (!initial) return <Loader />;
  return <CategoryForm id={id} initial={initial} />;
}

export default function CategoryEditPage({ params }) {
  const { id } = use(params);
  return (
    <PageGate permission="edit categories">
      <EditForm id={id} />
    </PageGate>
  );
}
