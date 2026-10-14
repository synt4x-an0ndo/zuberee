"use client";

import { useMemo } from "react";
import { FiUserCheck } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, ErrorState, Skeleton, Stat } from "@/components/ui";
import { api, formatMoney } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

export default function CustomerLeaderboardPage() {
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
        orders: 0,
        total: 0,
      };
      current.orders += 1;
      current.total += Number(order.total || 0);
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.total - a.total || b.orders - a.orders);
  }, [data]);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Sales" title="Customer leaderboard" subtitle="Recognise your most valuable customers." />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 240 }} /> : (
        <>
          <div className="stat-grid stagger">
            <Stat label="Top customers" value={rows.length} icon={FiUserCheck} tone="brand" />
            <Stat label="Highest spender" value={rows[0] ? formatMoney(rows[0].total) : "—"} icon={FiUserCheck} tone="info" />
          </div>
          <DataTable>
            <thead>
              <tr>
                <th style={{ width: 88 }}>Rank</th>
                <th>Customer</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Total spent</th>
                <th>Badge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  <td className="num">{String(index + 1).padStart(2, "0")}</td>
                  <td><strong>{row.name}</strong></td>
                  <td className="text-right num">{row.orders}</td>
                  <td className="text-right num">{formatMoney(row.total)}</td>
                  <td><Badge tone={index === 0 ? "brand" : index < 3 ? "info" : "neutral"}>{index === 0 ? "Gold" : index < 3 ? "Silver" : "Member"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </div>
  );
}
