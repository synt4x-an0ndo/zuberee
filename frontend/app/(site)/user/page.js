"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiBox, FiCalendar, FiCheckCircle, FiClock, FiPhone, FiShield, FiUser } from "react-icons/fi";
import Img from "@/components/Img";
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, Stat } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { api, formatMoney, imgUrl } from "@/lib/api";
import { normalizeOrders } from "@/lib/order";
import { formatDate, formatOrderNumber, orderStatusMeta } from "@/lib/format";

export default function AccountOverview() {
  const { user } = useAuth();
  const [recent, setRecent] = useState({ loading: true, orders: [], error: "" });

  useEffect(() => {
    let alive = true;
    api
      .get("api/account/orders", { params: { per_page: 3 } })
      .then((body) => alive && setRecent({ loading: false, orders: normalizeOrders(body.data), error: "" }))
      .catch((err) => alive && setRecent({ loading: false, orders: [], error: err.message }));
    return () => {
      alive = false;
    };
  }, []);

  const stats = user?.stats || { total_orders: 0, pending_orders: 0, delivered_orders: 0 };
  const isAdmin = user?.role === "admin";

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1>Hi, {user?.name?.split(" ")[0] || "there"}</h1>
      </div>

      <div className="profile-box">
        <div className="profile-box-avatar">
          {imgUrl(user?.image) ? <Img src={imgUrl(user.image)} alt={user?.name || "Profile photo"} fill sizes="96px" /> : <FiUser aria-hidden="true" />}
        </div>
        <h2 className="profile-box-name">{user?.name || "—"}</h2>
        {user?.email && <p className="profile-box-email">{user.email}</p>}
        {user?.phone && (
          <p className="profile-box-phone">
            <FiPhone aria-hidden="true" /> {user.phone}
          </p>
        )}
        {isAdmin && (
          <span className="profile-box-badge">
            <FiShield aria-hidden="true" /> Admin
          </span>
        )}
        <p className="profile-box-meta">
          <FiCalendar aria-hidden="true" /> Member since {user?.joinedAt ? formatDate(user.joinedAt) : "—"}
        </p>
        {isAdmin && (
          <Button href="/admin" variant="primary" className="profile-box-admin-btn">
            <FiShield aria-hidden="true" /> Go to admin page
          </Button>
        )}
      </div>

      <div className="stat-grid">
        <Stat label="Total orders" value={stats.total_orders} icon={FiBox} tone="brand" />
        <Stat label="In progress" value={stats.pending_orders} icon={FiClock} tone="warn" />
        <Stat label="Delivered" value={stats.delivered_orders} icon={FiCheckCircle} tone="success" />
      </div>

      <Card>
        <CardHeader title="Recent orders" actions={<Link href="/user/orders" className="link-arrow">View all</Link>} />
        {recent.loading ? (
          <div className="stack"><Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 64 }} /></div>
        ) : recent.error ? (
          <p className="notice notice-danger">{recent.error}</p>
        ) : recent.orders.length === 0 ? (
          <EmptyState title="No orders yet" text="When you place an order it will show up here." action={<Link href="/shop" className="btn btn-primary">Start shopping</Link>} />
        ) : (
          <ul className="status-list">
            {recent.orders.map((order) => {
              const meta = orderStatusMeta(order.status);
              return (
                <li key={order.id}>
                  <div>
                    <strong className="num">{formatOrderNumber(order)}</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.88rem" }}>{formatDate(order.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="num">{formatMoney(order.total_amount)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
