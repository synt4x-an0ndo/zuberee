"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Shipping cost settings (/dashboard/shipping)
 *  - GET api/shipping-costs              (list of saved rules)
 *  - POST api/shipping-costs             {shipping_type, inside_dhaka,
 *                                          outside_dhaka, one_shipping_cost}
 *  - GET api/shipping-costs-latest       (storefront checkout default)
 * shipping_type: 'inside_outside' | 'one'
 */
function ShippingSettings() {
  const [type, setType] = useState("");
  const [form, setForm] = useState({
    inside_dhaka: "",
    outside_dhaka: "",
    one_shipping_cost: "",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, latest] = await Promise.all([
          api.get("api/shipping-costs").catch(() => null),
          api.get("api/shipping-costs-latest", { auth: false }).catch(() => null),
        ]);
        if (!alive) return;
        const data = list?.data?.data || list?.data || [];
        setRows(Array.isArray(data) ? data : []);
        const cur = latest?.data || latest;
        if (cur) {
          setType(cur.shipping_type || (cur.one_shipping_cost != null ? "one" : ""));
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
      await api.post("api/shipping-costs", {
        shipping_type: type,
        ...(type === "inside_outside"
          ? {
              inside_dhaka: Number(form.inside_dhaka),
              outside_dhaka: Number(form.outside_dhaka),
            }
          : { one_shipping_cost: Number(form.one_shipping_cost) }),
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

        {rows.length > 0 && (
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-header bg-white fw-bold">Saved rules</div>
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
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.shipping_type || r.type}</td>
                      <td>{r.inside_dhaka != null ? `৳${r.inside_dhaka}` : "—"}</td>
                      <td>{r.outside_dhaka != null ? `৳${r.outside_dhaka}` : "—"}</td>
                      <td>{r.one_shipping_cost != null ? `৳${r.one_shipping_cost}` : "—"}</td>
                    </tr>
                  ))}
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
