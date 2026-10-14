"use client";

import { useMemo } from "react";
import { FiUsers } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, EmptyState, ErrorState, Skeleton, Stat } from "@/components/ui";
import { api, formatMoney } from "@/lib/api";
import { formatDateTime, orderStatusMeta } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function CustomersPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const body = await api.get("api/admin/orders", { params: { per_page: 300 } });
    return Array.isArray(body.data) ? body.data : [];
  }, []);

  const rows = useMemo(() => {
    const map = new Map();
    for (const order of data || []) {
      const key = `${String(order.phone || "").trim() || order.name || order.id}`;
      const current = map.get(key) || {
        key,
        name: order.name || "Guest",
        phone: order.phone || "—",
        orders: 0,
        total: 0,
        last: null,
        statuses: new Set(),
      };
      current.orders += 1;
      current.total += Number(order.total || 0);
      current.last = !current.last || new Date(order.created_at) > new Date(current.last) ? order.created_at : current.last;
      current.statuses.add(String(order.status || "").toLowerCase());
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.orders - a.orders || b.total - a.total);
  }, [data]);

  const newThisMonth = useMemo(() => {
    const now = new Date();
    return rows.filter((row) => {
      const d = new Date(row.last);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [rows]);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Sales" title="Customers" subtitle="Customer profiles, contact details and order history." />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 240 }} /> : (
        <>
          <div className="stat-grid stagger">
            <Stat label="Customers" value={rows.length} icon={FiUsers} tone="brand" />
            <Stat label="New this month" value={newThisMonth} icon={FiUsers} tone="info" />
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No customers yet" text="Customer rows will appear as orders are placed." />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th className="text-right">Orders</th>
                  <th>Last activity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const activeStatus = orderStatusMeta([...row.statuses].pop());
                  return (
                    <tr key={row.key}>
                      <td><strong>{row.name}</strong></td>
                      <td className="muted">{row.phone}</td>
                      <td className="text-right num">{row.orders}</td>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.last)}</td>
                      <td><Badge tone={activeStatus.tone}>{activeStatus.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </>
      )}
    </div>
  );
}
