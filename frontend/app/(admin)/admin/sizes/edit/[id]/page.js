"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SizeForm from "@/components/admin/SizeForm";
import PageGate from "@/components/admin/PageGate";
import { api } from "@/lib/api";
import Loader from "@/components/Loader";

/** GET + PUT api/sizes/{id} */
function EditSize({ id }) {
  const [initial, setInitial] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`api/sizes/${id}`);
        if (alive) setInitial(r?.data || r || {});
      } catch {
        if (alive) setInitial({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);
  if (!initial) return <Loader />;
  return <SizeForm id={id} initial={initial} />;
}

export default function SizesEditPage() {
  const { id } = useParams();
  return (
    <PageGate permission="edit sizes">
      <EditSize id={id} />
    </PageGate>
  );
}
