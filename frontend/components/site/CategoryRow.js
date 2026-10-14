"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ErrorState, Skeleton } from "@/components/ui";
import { api, listOf } from "@/lib/api";
import { normalizeProduct } from "@/lib/format";

/** A homepage product section for one category. Hidden when the category has no active products. */
export default function CategoryRow({ category }) {
  const [state, setState] = useState({ loading: true, error: "", products: [] });

  useEffect(() => {
    let alive = true;
    api
      .get("api/product-pagination", { auth: false, params: { category: category.slug, per_page: 8 } })
      .then((response) => {
        if (!alive) return;
        setState({ loading: false, error: "", products: listOf(response).map(normalizeProduct).filter(Boolean) });
      })
      .catch((error) => alive && setState({ loading: false, error: error.message, products: [] }));
    return () => {
      alive = false;
    };
  }, [category.slug]);

  if (!state.loading && !state.error && state.products.length === 0) return null;

  return (
    <section className="section category-product-row" aria-labelledby={`row-${category.id}`}>
      <div className="section-head">
        <div>
          <h2 id={`row-${category.id}`}>{category.name}</h2>
        </div>
        <Link href={`/${category.slug}`} className="category-view-all">
          View All
        </Link>
      </div>
      {state.error ? (
        <ErrorState message={state.error} />
      ) : state.loading ? (
        <div className="product-grid is-compact">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <Skeleton style={{ aspectRatio: "4 / 5", width: "100%", borderRadius: 0 }} />
              <div style={{ padding: "0.9rem" }}>
                <Skeleton style={{ height: 14, width: "80%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="product-grid is-compact stagger">
          {state.products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
