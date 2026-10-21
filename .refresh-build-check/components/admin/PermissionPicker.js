"use client";

import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { Input } from "@/components/ui";
import { groupPermissions, permissionLabel } from "@/lib/permissions";

/**
 * Permission selection for a role.
 *
 * The catalogue comes from GET /api/admin/permissions and the selection is kept as
 * permission *names* so the list stays readable; the caller converts names to the
 * `permission_ids` the backend expects.
 */
export default function PermissionPicker({ catalog = [], selected = [], onChange, disabled = false }) {
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const groups = useMemo(() => {
    const all = groupPermissions(catalog);
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all
      .map((group) => ({
        group: group.group,
        items: group.items.filter((name) => name.toLowerCase().includes(term)),
      }))
      .filter((group) => group.items.length > 0);
  }, [catalog, query]);

  const toggle = (name) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(Array.from(next));
  };

  const toggleGroup = (items) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    const allSelected = items.every((name) => next.has(name));
    items.forEach((name) => {
      if (allSelected) next.delete(name);
      else next.add(name);
    });
    onChange(Array.from(next));
  };

  const totalVisible = groups.reduce((sum, group) => sum + group.items.length, 0);
  const selectedVisible = groups.reduce(
    (sum, group) => sum + group.items.filter((name) => selectedSet.has(name)).length,
    0
  );

  return (
    <div className="perm-picker">
      <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: "200px" }}>
          <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 13, color: "var(--muted)" }} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search permissions"
            aria-label="Search permissions"
            style={{ paddingLeft: 36 }}
            disabled={disabled}
          />
        </div>
        <span className="muted" style={{ fontSize: "0.84rem", whiteSpace: "nowrap" }}>
          {selectedVisible} of {totalVisible} shown selected
        </span>
        {selected.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])} disabled={disabled}>
            Clear selection
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          {catalog.length === 0 ? "No permissions are available." : "No permission matches your search."}
        </p>
      ) : (
        <div className="perm-groups">
          {groups.map((group) => {
            const allSelected = group.items.every((name) => selectedSet.has(name));
            const someSelected = group.items.some((name) => selectedSet.has(name));
            return (
              <fieldset key={group.group} className="perm-group">
                <legend className="perm-group-head">
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = !allSelected && someSelected;
                      }}
                      onChange={() => toggleGroup(group.items)}
                      disabled={disabled}
                      aria-label={`Select all ${group.group} permissions`}
                    />
                    <span className="perm-group-name">{permissionLabel(group.group)}</span>
                  </label>
                  <span className="count-pill" style={{ marginLeft: 0 }}>
                    {group.items.filter((name) => selectedSet.has(name)).length}/{group.items.length}
                  </span>
                </legend>
                <div className="perm-items">
                  {group.items.map((name) => (
                    <label key={name} className="check-line perm-item">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(name)}
                        onChange={() => toggle(name)}
                        disabled={disabled}
                      />
                      <span>{permissionLabel(name)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}
