"use client";

import Link from "next/link";

/**
 * Standalone size CRUD is not part of the documented API.
 * Product sizes are managed as variants in the product editor.
 */
export default function SizeForm() {
  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0 fw-bold">Product Size Variants</h4>
          <Link href="/admin/sizes" className="btn btn-sm btn-outline-secondary">
            ← Back
          </Link>
        </div>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <p className="text-muted mb-3">
              Sizes are product variants. Open a product to add or edit its sizes, prices, and stock.
            </p>
            <Link href="/admin/products" className="btn btn-grad px-4 fw-semibold">
              Open Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
