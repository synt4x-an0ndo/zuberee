"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import "@/styles/css/4bbd025722010dd0.css";
import Loader from "@/components/Loader";

/**
 * Website color (/dashboard/theme-settings)
 *  - GET api/site-settings   -> {data:{primary_color, ...}}
 *  - PUT api/site-settings   {primary_color}
 * The live preview re-renders the storefront accents instantly.
 */
function ThemeSettings() {
  const [color, setColor] = useState("#ff641f");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/site-settings", { auth: false });
        if (r?.data?.primary_color) setColor(r.data.primary_color);
      } catch {
        notify.error("Could not load the saved website color.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("api/site-settings", { primary_color: color });
      document.documentElement.style.setProperty("--primary", color);
      notify.success("Website color saved");
    } catch (err) {
      notify.error(err.message || "Failed to save color");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <h4 className="fw-bold mb-3">Website Color</h4>
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-4">
            <form onSubmit={save} className="d-flex gap-3 align-items-end flex-wrap">
              <div>
                <label className="form-label fw-semibold">Choose color</label>
                <input
                  type="color"
                  className="form-control form-control-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label fw-semibold">Hex code</label>
                <input
                  className="form-control"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  pattern="^#?[0-9A-Fa-f]{6}$"
                />
              </div>
              <button className="btn btn-grad px-4" disabled={saving}>
                {saving ? "Saving..." : "Save Color"}
              </button>
            </form>
          </div>
        </div>

        {/* live preview */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white fw-bold">Live preview</div>
          <div className="card-body text-center">
            <div
              className="rounded p-4 mb-3"
              style={{ background: `${color}14`, border: `1px solid ${color}33` }}
            >
              <h4 className="fw-bold" style={{ color }} />
              <p className="text-muted small mb-3">
                Preview of buttons, links and accents with your selected color.
              </p>
              <div className="d-flex gap-2 justify-content-center">
                <button
                  className="btn"
                  style={{ background: color, color: "#fff" }}
                >
                  Add to Cart
                </button>
                <button
                  className="btn btn-outline-dark"
                  style={{ borderColor: color, color }}
                >
                  View Details
                </button>
                <button
                  className="btn"
                  style={{ background: color, color: "#fff" }}
                >
                  Buy Now
                </button>
              </div>
            </div>
            <div
              className="d-inline-block p-2 rounded text-white"
              style={{ background: color }}
            >
              Primary swatch {color}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThemeSettingsPage() {
  return (
    <PageGate permission="view settings">
      <ThemeSettings />
    </PageGate>
  );
}
