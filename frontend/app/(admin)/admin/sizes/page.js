"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";

/** Product sizes are documented as variants in GET /api/products. */
function SizesList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("api/products", { auth: false });
      const products = Array.isArray(r) ? r : r?.data || [];
      const variants = products.flatMap((product) =>
        (Array.isArray(product.sizes) ? product.sizes : []).map((size) => ({
          id: `${product.id}-${size.id}`,
          size: size.size,
          productId: product.id,
          productTitle: product.title || product.name || `Product #${product.id}`,
        }))
      );
      setRows(variants);
    } catch (e) {
      notify.error(e.message || "Failed to load sizes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0 fw-bold">Sizes</h4>
        <Link href="/admin/products" className="btn btn-grad">
          Manage in Products
        </Link>
      </div>
      <div className="alert alert-info" role="status">
        Product sizes are managed as size variants inside each product. Use the Products page to add or edit them.
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th>Product ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-4">
                    <span className="spinner-border spinner-border-sm" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted">
                    No Sizes Found
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.productTitle}</td>
                    <td className="fw-semibold">{s.size}</td>
                    <td>{s.productId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SizesAdminPage() {
  return (
    <PageGate permission="view sizes">
      <SizesList />
    </PageGate>
  );
}
