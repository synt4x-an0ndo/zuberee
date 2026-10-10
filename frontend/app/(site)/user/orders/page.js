"use client";

import { AccountOrdersPanel } from "@/components/AccountPages";

// User Orders — reuses the existing order-history UI via AccountOrdersPanel.
export default function UserOrdersPage() {
    return <AccountOrdersPanel />;
}
