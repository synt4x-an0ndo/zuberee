"use client";

import SizeForm from "@/components/admin/SizeForm";
import PageGate from "@/components/admin/PageGate";

/** Product sizes are managed as variants in the product editor. */
export default function SizesAddPage() {
  return (
    <PageGate permission="create sizes">
      <SizeForm />
    </PageGate>
  );
}
