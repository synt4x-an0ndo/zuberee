import { Suspense } from "react";
import ProductListing from "@/components/site/ProductListing";

export const metadata = { title: "Shop" };

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="container section" />}>
      <ProductListing heading="Shop" />
    </Suspense>
  );
}
