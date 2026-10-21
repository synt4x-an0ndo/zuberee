"use client";

import { useEffect, useRef } from "react";

// Cache row geometry only, never records or column widths. Native auto layout
// keeps header/body tracks aligned and reflows when content or the viewport changes.
const layouts = new Map();
const MIN_ROW_HEIGHT = 56;

export default function AlignedTable({ children, className = "", style, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const table = ref.current;
    if (!table) return undefined;
    let frame = 0;
    let disposed = false;

    const align = () => {
      frame = 0;
      if (disposed || !table.isConnected || table.getBoundingClientRect().width === 0) return;
      const heads = Array.from(table.tHead?.rows[0]?.cells || []);
      const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows));
      // A loading/empty/detail row spanning the table is not a record row.
      const records = rows.filter(row => row.cells.length > 1 && Array.from(row.cells).every(cell => cell.colSpan === 1 && cell.rowSpan === 1));
      const signature = heads.map(cell => `${cell.textContent.trim()}:${cell.className}`).join("|");
      const key = `${window.location.pathname}|${signature || "row-headers"}`;
      let cached = layouts.get(key);

      if (heads.length && records.length && !table.querySelector("thead [colspan], thead [rowspan]")) {
        heads.forEach((head, index) => {
          const cells = records.map(row => row.cells[index]).filter(Boolean);
          const action = /^actions?$/i.test(head.textContent.trim());
          const center = head.classList.contains("orders-select-col") || head.classList.contains("text-center");
          const right = action || head.classList.contains("text-right") || cells.some(cell => cell.classList.contains("text-right"));
          const alignment = center ? "center" : right ? "right" : "left";
          head.dataset.columnAlign = alignment;
          cells.forEach(cell => { cell.dataset.columnAlign = alignment; });
        });
      }

      // Measure natural content first. Native table layout then applies the same
      // minimum height to every record; content is never clipped or ellipsized.
      table.style.setProperty("--aligned-row-height", `${MIN_ROW_HEIGHT}px`);
      const naturalHeight = records.reduce((height, row) => Math.max(height, Math.ceil(row.getBoundingClientRect().height)), MIN_ROW_HEIGHT);
      const rowHeight = Math.max(cached?.rowHeight || MIN_ROW_HEIGHT, naturalHeight);
      table.style.setProperty("--aligned-row-height", `${rowHeight}px`);
      if (records.length) {
        layouts.set(key, { ...layouts.get(key), rowHeight });
        if (layouts.size > 64) layouts.delete(layouts.keys().next().value);
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(align);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(table);
    if (table.parentElement) resize?.observe(table.parentElement);
    const changes = new MutationObserver(schedule);
    changes.observe(table, { childList: true, characterData: true, subtree: true });
    table.addEventListener("load", schedule, true);
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(() => { if (!disposed) schedule(); });
    schedule();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resize?.disconnect();
      changes.disconnect();
      table.removeEventListener("load", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return <table {...props} ref={ref} className={`aligned-table ${className}`.trim()} style={style}>
    {children}
  </table>;
}
