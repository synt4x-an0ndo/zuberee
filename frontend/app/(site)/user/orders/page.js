"use client";

import Link from "next/link";
import { FiImage } from "react-icons/fi";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Pagination, Skeleton, cx } from "@/components/ui";
import Img from "@/components/Img";
import { api, formatMoney } from "@/lib/api";
import { normalizeOrders } from "@/lib/order";
import { ORDER_STATUS, formatDateTime, formatOrderNumber, orderStatusMeta, paymentStatusMeta } from "@/lib/format";

const FILTERS = [{ value: "", label: "All" }, ...Object.entries(ORDER_STATUS).map(([value, m]) => ({ value, label: m.label }))];

export default function MyOrdersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: "", orders: [], meta: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const body = await api.get("api/account/orders", { params: { page, per_page: 10, ...(status ? { status } : {}) } });
      setState({ loading: false, error: "", orders: normalizeOrders(body.data), meta: body.meta || null });
    } catch (err) {
      setState({ loading: false, error: err.message, orders: [], meta: null });
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <p className="eyebrow">Account</p>
          <h1>My orders</h1>
        </div>
      </div>

      <div className="chip-row" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f.value || "all"} type="button" role="tab" aria-selected={status === f.value} className={cx("chip", status === f.value && "is-active")} onClick={() => { setStatus(f.value); setPage(1); }}>
            {f.label}
          </button>
        ))}
      </div>

      {state.loading ? (
        <div className="stack"><Skeleton style={{ height: 150 }} /><Skeleton style={{ height: 150 }} /></div>
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : state.orders.length === 0 ? (
        <EmptyState title={status ? "No orders with this status" : "No orders yet"} text="Orders you place will appear here." action={<Button href="/shop" variant="primary">Shop now</Button>} />
      ) : (
        <div className="stack stagger" style={{ gap: 14 }}>
          {state.orders.map((order) => {
            const meta = orderStatusMeta(order.status);
            const pay = paymentStatusMeta(order.payment_status);
            return (
              <article key={order.id} className="card order-card">
                <header className="order-card-head">
                  <div>
                    <strong className="num">{formatOrderNumber(order)}</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.88rem" }}>{formatDateTime(order.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <Badge tone={pay.tone}>{pay.label}</Badge>
                  </div>
                </header>
                <ul className="order-items">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <div className="order-item-product">
                        <div className={item.image ? "order-item-thumb" : "order-item-thumb order-item-thumb-empty"}>
                          {item.image ? <Img src={item.image} alt="" width={48} height={56} sizes="48px" /> : <FiImage aria-hidden="true" />}
                        </div>
                        <div className="order-item-copy">
                          <span>{item.title || "Product"}</span>
                          <span className="muted">&times; {item.quantity}</span>
                        </div>
                      </div>
                      <span className="num order-item-price">{formatMoney(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <footer className="order-card-foot">
                  <span className="muted" style={{ fontSize: "0.9rem" }}>{order.shipping_address}</span>
                  <span className="num" style={{ fontWeight: 700 }}>Total {formatMoney(order.total_amount)}</span>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {state.meta && state.meta.total_pages > 1 && (
        <Pagination page={state.meta.current_page || page} totalPages={state.meta.total_pages} onChange={setPage} />
      )}
      <p className="muted" style={{ fontSize: "0.88rem" }}>
        Need help with an order? <Link href="/track-order" className="link-arrow">Track it</Link> or{" "}
        <Link href="/return_policy" className="link-arrow">read our return policy</Link>.
      </p>
    </div>
  );
}
