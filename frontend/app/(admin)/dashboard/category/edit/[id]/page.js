"use client";

import { use, useEffect, useState } from "react";
import CategoryForm from "@/components/admin/CategoryForm";
import PageGate from "@/components/admin/PageGate";
import { api } from "@/lib/api";
import Loader from "@/components/Loader";
import notify from "@/components/notify";

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
        const payload = r?.data ?? r;
        const c = payload?.category || payload?.data || payload;
        setInitial({
          name: c.name || "",
          slug: c.slug || "",
          description: c.description || "",
        });
      } catch (error) {
        if (alive) {
          setMissing(true);
          notify.error(error?.message || "Category not found.");
        }
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
