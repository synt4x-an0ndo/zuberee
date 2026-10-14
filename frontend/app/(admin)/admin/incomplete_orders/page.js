"use client";

import { useState } from "react";
import { FiFilter, FiRefreshCw } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";

const STATUS_OPTIONS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["COMPLETED", "Completed"],
  ["PLACED", "Placed"],
  ["CANCELLED", "Cancelled"],
  ["PROCESSING", "Processing"],
  ["RETURNED", "Returned"],
  ["FIRST_CALL_DONE", "1st Call Done"],
  ["SECOND_CALL_DONE", "2nd Call Done"],
  ["THIRD_CALL_DONE", "3rd Call Done"],
  ["STOCK_SOLD", "Stock Sold"],
  ["SHIPPED_TO_YOU", "Shipped To You"],
  ["RECEIVED_IN_BD", "Received In BD"],
  ["ORDER_SENT_TO_CHINA", "Order Sent To China"],
  ["FILE_COMPLETED", "File Completed"],
  ["ORDER_CONFIRMED", "Order Confirmed"],
];

export default function IncompleteOrdersPage() {
  const { toast } = useFeedback();
  const [filters, setFilters] = useState({ startDate: "", endDate: "", status: "" });

  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const reset = () => setFilters({ startDate: "", endDate: "", status: "" });
  const filter = (event) => {
    event.preventDefault();
    toast.info("Incomplete orders will load when the backend endpoint is connected.");
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Sales"
        title="Incomplete orders"
        subtitle="Review unfinished checkouts and convert them into orders."
        actions={<Button variant="ghost" size="sm" onClick={() => toast.info("Incomplete orders will refresh when the backend endpoint is connected.")}><FiRefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      <Card>
        <CardHeader title="Filter incomplete orders" subtitle="Search by date range and order status." />
        <form onSubmit={filter} className="card-pad" style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <Field label="Start date" htmlFor="incomplete-start-date">
            <Input id="incomplete-start-date" type="date" value={filters.startDate} onChange={update("startDate")} />
          </Field>
          <Field label="End date" htmlFor="incomplete-end-date">
            <Input id="incomplete-end-date" type="date" value={filters.endDate} onChange={update("endDate")} />
          </Field>
          <Field label="Status" htmlFor="incomplete-status">
            <Select id="incomplete-status" value={filters.status} onChange={update("status")} options={STATUS_OPTIONS.map(([value, label]) => ({ value, label }))} />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <Button type="submit" variant="primary"><FiFilter aria-hidden="true" /> Filter</Button>
            <Button type="button" variant="outline" onClick={reset}>Reset</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Incomplete orders" subtitle="Orders that have not yet been converted from checkout." />
        <DataTable>
          <thead>
            <tr>
              {["#", "Name", "Phone", "Address", "Cart items", "Status", "Conversion", "Date", "Action"].map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={9}>
                <EmptyState title="No incomplete orders loaded" text="The table is ready for the incomplete-orders API. Customer details, cart items, status, date and conversion actions will appear here." />
              </td>
            </tr>
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
}
