"use client";

import CategoryForm from "@/components/admin/CategoryForm";
import PageGate from "@/components/admin/PageGate";

/** Create collection - POST api/categories */
export default function CategoryAddPage() {
  return (
    <PageGate permission="create categories">
      <CategoryForm />
    </PageGate>
  );
}
