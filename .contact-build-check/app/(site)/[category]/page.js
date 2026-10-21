"use client";

import { notFound, useParams } from "next/navigation";
import { Suspense } from "react";
import ProductListing from "@/components/site/ProductListing";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useSite } from "@/context/SiteContext";

export default function CategoryPage() {
  const { category: slug } = useParams();
  const { categories, loading, error, reload } = useSite();

  if (loading) {
    return (
      <div className="container section">
        <Skeleton style={{ height: 40, width: 260, marginBottom: 24 }} />
        <Skeleton style={{ height: 360 }} />
      </div>
    );
  }

  if (error && !categories.bySlug.size) {
    return (
      <div className="container section">
        <ErrorState message="We could not load this collection." onRetry={reload} />
      </div>
    );
  }

  const node = categories.bySlug.get(slug);
  if (!node) notFound();

  const isChild = Boolean(node.parentName);
  return (
    <Suspense fallback={<div className="container section" />}>
      <ProductListing
        fixedCategory={node.slug}
        heading={node.name}
        eyebrow={isChild ? node.parentName : "Collection"}
        subtitle={node.description || `Shop our ${node.name} edit.`}
        showCategoryFilter={false}
      />
    </Suspense>
  );
}
