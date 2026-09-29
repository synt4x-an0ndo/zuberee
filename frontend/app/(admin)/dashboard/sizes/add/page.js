"use client";

import SizeForm from "@/components/admin/SizeForm";
import PageGate from "@/components/admin/PageGate";

/** POST api/sizes {size} */
export default function SizesAddPage() {
  return (
    <PageGate permission="create sizes">
      <SizeForm />
    </PageGate>
  );
}
