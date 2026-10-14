"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Shipping cost settings (/dashboard/shipping)
 *  - GET  api/admin/shipping-costs-latest   (current rule — direct object)
 *  - POST api/admin/shipping-costs          {inside_dhaka, outside_dhaka,
 *                                            one_shipping_cost} (creates a new
 *                                            versioned row)
 * The latest endpoint is admin-only, so it is called with the JWT.
 */
function ShippingSettings() {
  const [type, setType] = useState("");
  const [form, setForm] = useState({
    inside_dhaka: "",
    outside_dhaka: "",
    one_shipping_cost: "",
  });
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const latest = await api.get("api/admin/shipping-costs-latest").catch(() => null);
        if (!alive) return;
        const cur = latest || null;
        setCurrent(cur);
        if (cur) {
          setType(cur.one_shipping_cost != null ? "one" : "inside_outside");
          setForm({
            inside_dhaka: cur.inside_dhaka ?? "",
            outside_dhaka: cur.outside_dhaka ?? "",
            one_shipping_cost: cur.one_shipping_cost ?? "",
          });
        }
      } catch {
        notify.error("Failed to load shipping settings");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!type) return notify.error("Please select shipping type");
    if (type === "inside_outside" && (!form.inside_dhaka || !form.outside_dhaka))
      return notify.error("Inside/Outside Dhaka costs are required");
    if (type === "one" && !form.one_shipping_cost)
      return notify.error("Shipping cost is required");
    setSaving(true);
    try {
      await api.post("api/admin/shipping-costs", {
        ...(type === "inside_outside"
          ? {
              inside_dhaka: Number(form.inside_dhaka),
              outside_dhaka: Number(form.outside_dhaka),
            }
          : {
              inside_dhaka: Number(current?.inside_dhaka ?? 0),
              outside_dhaka: Number(current?.outside_dhaka ?? 0),
              one_shipping_cost: Number(form.one_shipping_cost),
            }),
      });
      notify.success("Shipping settings saved");
    } catch (err) {
      notify.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-7">
        <h4 className="fw-bold mb-3">Shipping Cost</h4>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Shipping Type:</label>
                <select
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">Select Type</option>
                  <option value="inside_outside">Inside/Outside Dhaka</option>
                  <option value="one">One Shipping Cost</option>
                </select>
              </div>

              {type === "inside_outside" && (
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">
                      Inside Dhaka Cost (৳):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.inside_dhaka}
                      onChange={(e) => set("inside_dhaka", e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">
                      Outside Dhaka Cost (৳):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.outside_dhaka}
                      onChange={(e) => set("outside_dhaka", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {type === "one" && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Shipping Cost (৳) - Applicable For All Districts:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.one_shipping_cost}
                    onChange={(e) => set("one_shipping_cost", e.target.value)}
                  />
                </div>
              )}

              <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        </div>

        {current && (
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-header bg-white fw-bold">Current rule</div>
            <div className="card-body p-0">
              <table className="table mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Type</th>
                    <th>Inside Dhaka</th>
                    <th>Outside Dhaka</th>
                    <th>One cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{current.one_shipping_cost != null ? "One cost" : "Inside/Outside Dhaka"}</td>
                    <td>{current.inside_dhaka != null ? `৳${current.inside_dhaka}` : "—"}</td>
                    <td>{current.outside_dhaka != null ? `৳${current.outside_dhaka}` : "—"}</td>
                    <td>{current.one_shipping_cost != null ? `৳${current.one_shipping_cost}` : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShippingAdminPage() {
  return (
    <PageGate permission="view settings">
      <ShippingSettings />
    </PageGate>
  );
}
