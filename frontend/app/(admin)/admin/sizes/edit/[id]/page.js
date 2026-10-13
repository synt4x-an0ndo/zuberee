"use client";

import { useParams } from "next/navigation";
import SizeForm from "@/components/admin/SizeForm";
import PageGate from "@/components/admin/PageGate";

function EditSize({ id }) {
  return <SizeForm id={id} />;
}

export default function SizesEditPage() {
  const { id } = useParams();
  return (
    <PageGate permission="edit sizes">
      <EditSize id={id} />
    </PageGate>
  );
}
