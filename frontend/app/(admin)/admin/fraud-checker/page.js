"use client";

import { useState } from "react";
import { FiCheckCircle, FiInfo, FiSave, FiSend } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";

export default function CourierCheckerPage() {
  const { toast } = useFeedback();
  const [apiKey, setApiKey] = useState("");
  const [cacheMinutes, setCacheMinutes] = useState("60");
  const [enabled, setEnabled] = useState(true);
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  const save = (event) => {
    event.preventDefault();
    setSaved(true);
    toast.success("Courier checker settings saved locally. Backend integration is pending.");
  };

  const test = (event) => {
    event.preventDefault();
    if (!phone.trim()) {
      toast.error("Enter a Bangladesh mobile number first.");
      return;
    }
    toast.info("The courier API test will be enabled when the backend endpoint is connected.");
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Courier Management"
        title="Courier History Checker"
        subtitle="Configure the courier history lookup used from the order list."
      />

      <Card>
        <CardHeader
          title="Courier checker settings"
          subtitle="The API key will be stored by the backend and never exposed to the browser."
        />
        <form onSubmit={save} className="stack" style={{ maxWidth: 720 }}>
          <Field label="BD Courier API key" htmlFor="courier-api-key" hint="Leave blank to keep the currently configured key.">
            <Input id="courier-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Configured key or enter a new key" />
          </Field>
          <div className="form-grid">
            <Field label="Cache result (minutes)" htmlFor="courier-cache" hint="Use 0 to disable caching.">
              <Input id="courier-cache" type="number" min="0" value={cacheMinutes} onChange={(event) => setCacheMinutes(event.target.value)} />
            </Field>
            <div style={{ alignSelf: "end", paddingBottom: 10 }}>
              <Toggle checked={enabled} onChange={setEnabled} label="Enable courier checker" />
            </div>
          </div>
          <div className="notice notice-info">
            <FiInfo aria-hidden="true" />
            <span>The provider endpoint is fixed on the server for security and will be supplied by the backend integration.</span>
          </div>
          <div>
            <Button type="submit" variant="primary"><FiSave aria-hidden="true" /> {saved ? "Settings saved" : "Save settings"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Test connection" subtitle="Save the API key first, then test it with a known Bangladesh mobile number." />
        <form onSubmit={test} className="row" style={{ maxWidth: 720, alignItems: "end", gap: 12, flexWrap: "wrap" }}>
          <Field label="Mobile number" htmlFor="courier-phone" hint="Example: 017XXXXXXXX">
            <Input id="courier-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="017XXXXXXXX" />
          </Field>
          <Button type="submit" variant="outline"><FiSend aria-hidden="true" /> Test API</Button>
        </form>
        {saved && <p className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}><FiCheckCircle aria-hidden="true" /> Settings are ready for backend connection.</p>}
      </Card>
    </div>
  );
}
