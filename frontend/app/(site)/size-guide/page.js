"use client";

import Link from "next/link";
import { useState } from "react";
import { FiZap } from "react-icons/fi";
import InfoPage from "@/components/site/InfoPage";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

/**
 * Size guide. The backend has no content endpoint for this page (categories only
 * carry a NONE/SHOE/DRESS guide-type flag), so the charts are static here.
 *
 * "Find my size" reuses the store's Gemini integration (POST api/chat/ai — the
 * same route and server-held API key the chat assistant uses). The prompt embeds
 * ONLY the charts on this page, so the model can never invent sizes.
 */

const DRESS_ROWS = [
  ["XS", "32–33", "26–27", "35–36"],
  ["S", "34–35", "28–29", "37–38"],
  ["M", "36–37", "30–31", "39–40"],
  ["L", "38–40", "32–34", "41–43"],
  ["XL", "41–43", "35–37", "44–46"],
  ["XXL", "44–46", "38–40", "47–49"],
];

const SHOE_ROWS = [
  ["36", "22.5"],
  ["37", "23.5"],
  ["38", "24.0"],
  ["39", "25.0"],
  ["40", "25.5"],
  ["41", "26.5"],
  ["42", "27.0"],
];

const MEASURE_FIELDS = [
  { key: "height", label: "Height", unit: "cm", min: 100, max: 230, placeholder: "e.g. 163" },
  { key: "weight", label: "Weight", unit: "kg", min: 25, max: 250, placeholder: "e.g. 58" },
  { key: "chest", label: "Chest / Bust", unit: "in", min: 20, max: 70, placeholder: "e.g. 36" },
  { key: "waist", label: "Waist", unit: "in", min: 20, max: 70, placeholder: "e.g. 30" },
  { key: "hips", label: "Hips", unit: "in", min: 20, max: 75, placeholder: "e.g. 39" },
];

const SHOE_FIELDS = [
  { key: "foot", label: "Foot length", unit: "cm", min: 15, max: 35, placeholder: "e.g. 24.5" },
];

function chartText(mode) {
  if (mode === "shoes") {
    return `Shoe size chart (EU size = foot length in cm): ${SHOE_ROWS.map((r) => `${r[0]} = ${r[1]}cm`).join(", ")}`;
  }
  return `Clothing size chart (Size | Bust in | Waist in | Hip in): ${DRESS_ROWS.map((r) => `${r[0]} = ${r[1]} / ${r[2]} / ${r[3]}`).join("; ")}`;
}

function SizeTable({ head, rows, unit }) {
  return (
    <div className="size-table-wrap">
      <table className="size-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={`${row[0]}-${i}`} className={i === 0 ? "size-cell" : undefined}>
                  {cell}
                  {i > 0 && unit ? <span className="muted"> {unit}</span> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SizeRecommender() {
  const { toast } = useFeedback();
  const { isAuthenticated, user } = useAuth();
  const [mode, setMode] = useState("clothing");
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const fields = mode === "shoes" ? SHOE_FIELDS : MEASURE_FIELDS;
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const validate = () => {
    const provided = [];
    for (const f of fields) {
      const raw = String(values[f.key] ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < f.min || n > f.max) {
        return `${f.label} must be a number between ${f.min} and ${f.max} ${f.unit}.`;
      }
      provided.push(`${f.label}: ${n} ${f.unit}`);
    }
    if (provided.length === 0) return `Enter at least one ${mode === "shoes" ? "foot length" : "measurement"}.`;
    return provided;
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (typeof problem === "string") {
      setError(problem);
      return;
    }
    setError("");
    setBusy(true);
    setResult("");
    const kind = mode === "shoes" ? "shoe" : "clothing";
    const message = [
      `You are the personal fashion stylist for Zuberee, an online fashion boutique. A customer needs a ${kind} size recommendation. Their measurements: ${problem.join(", ")}.`,
      `Use ONLY this size chart: ${chartText(mode)}. If they fall between two sizes, recommend the larger one. Never mention a size that is not in the chart.`,
      `Reply in exactly two plain-text lines, no markdown, no asterisks, no bullets. Line 1 exactly: "Recommended size: <SIZE>". Line 2: one warm, refined sentence (max 22 words) explaining the fit, citing the matching numbers from the chart.`,
    ].join(" ");
    try {
      const res = await api.post("api/chat/ai", { message, history: [] });
      const raw = String(res?.data?.reply || "").replace(/[*#`_]/g, "").trim();
      const match = raw.match(/recommended size\s*[:\-]?\s*([^\n]+)/i);
      if (match) {
        const size = match[1].trim().replace(/[.,]+$/, "");
        const explanation = raw.slice(match.index + match[0].length).trim();
        setResult({ size, explanation });
      } else {
        setResult({ size: "", explanation: raw || "No recommendation came back — please try again in a moment." });
      }
    } catch (err) {
      const reason =
        err.status === 503
          ? "The AI assistant is not configured yet. Please try again later."
          : err.status === 401
            ? "Please sign in to use the AI size recommendation."
            : err.message || "The AI service is unavailable right now.";
      setError(reason);
      toast.error(reason);
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="card card-pad ai-size-card">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="ai-size-spark" aria-hidden="true"><FiZap /></span>
          <div style={{ flex: "1 1 260px" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Find my size (AI)</h2>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.92rem" }}>
              Sign in, enter a few measurements, and our AI stylist picks your best-fitting {mode === "shoes" ? "shoe" : "clothing"} size from the charts on this page.
            </p>
          </div>
          <Button href="/login?next=/size-guide" variant="primary">Sign in to continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad ai-size-card">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: "0.75rem" }}>
        <span className="ai-size-spark" aria-hidden="true"><FiZap /></span>
        <div>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Find my size (AI)</h2>
          <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
            Hi {user?.name?.split(" ")[0] ? `${user.name.split(" ")[0]}, ` : ""}enter your measurements and our AI stylist will pick the best fit from the charts below.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="stack" style={{ gap: "0.9rem" }} noValidate>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }} role="tablist" aria-label="What are you buying?">
          {[["clothing", "Clothing"], ["shoes", "Shoes"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              className={mode === value ? "tab is-active" : "tab"}
              onClick={() => { setMode(value); setError(""); setResult(""); }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ai-size-grid">
          {fields.map((f) => (
            <Field key={f.key} label={`${f.label} (${f.unit})`} htmlFor={`ai-${f.key}`}>
              <Input
                id={`ai-${f.key}`}
                type="number"
                inputMode="decimal"
                step="any"
                min={f.min}
                max={f.max}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={set(f.key)}
              />
            </Field>
          ))}
        </div>

        {error && <p className="notice notice-danger" role="alert">{error}</p>}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button type="submit" variant="primary" loading={busy} disabled={busy}>
            {busy ? "Thinking…" : "Recommend my size"}
          </Button>
          <span className="muted" style={{ fontSize: "0.82rem" }}>AI suggestion — approximate fit.</span>
        </div>

        {result && (
          <div className="ai-size-result" role="status">
            <span className="ai-size-eyebrow">Zuberee AI Stylist — your recommendation</span>
            {result.size ? (
              <p className="ai-size-headline">
                <span className="ai-size-value">{result.size}</span>
                <span className="ai-size-rest">size is recommended for you</span>
              </p>
            ) : null}
            {result.explanation ? <p className="ai-size-note">{result.explanation}</p> : null}
          </div>
        )}
      </form>
    </div>
  );
}

export default function SizeGuidePage() {
  return (
    <InfoPage eyebrow="Fit" title="Size guide" intro="Find the right fit before you order.">
      <div className="stack" style={{ gap: "1.5rem" }}>
        <SizeRecommender />

        <div className="card card-pad">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>Clothing</h2>
          <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
            Body measurements in inches. If you are between sizes, choose the larger one for a relaxed fit.
          </p>
          <SizeTable
            head={["Size", "Bust", "Waist", "Hip"]}
            rows={DRESS_ROWS}
            unit="in"
          />
        </div>

        <div className="card card-pad">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>Shoes</h2>
          <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
            Measure your foot from heel to the longest toe (in cm) and match it below.
          </p>
          <SizeTable
            head={["EU size", "Foot length"]}
            rows={SHOE_ROWS}
            unit="cm"
          />
        </div>

        <div className="card card-pad">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>How to measure</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: 6, fontSize: "0.95rem" }}>
            <li><strong>Bust:</strong> around the fullest part, keeping the tape level and snug — not tight.</li>
            <li><strong>Waist:</strong> around the narrowest part of your natural waistline.</li>
            <li><strong>Hip:</strong> around the fullest part of your hips, feet together.</li>
            <li><strong>Foot:</strong> stand on paper, mark heel and longest toe, measure the distance.</li>
          </ul>
          <p className="muted" style={{ margin: "0.9rem 0 0", fontSize: "0.88rem" }}>
            Measurements are approximate and may vary slightly per design. Unsure? Call us before ordering — we will help you pick.
          </p>
        </div>
      </div>
    </InfoPage>
  );
}
