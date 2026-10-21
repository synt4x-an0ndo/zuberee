"use client";

import { useEffect, useId, useRef, useState } from "react";
import ViewportPortal from "@/components/ViewportPortal";
import styles from "./DashboardStatusSelect.module.css";

// Scoped to the dashboard: native select popups cannot be constrained by page CSS.
export default function DashboardStatusSelect({ value, onChange, options, ...props }) {
  const id = useId();
  const trigger = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const search = useRef({ text: "", time: 0 });
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }

  function show(index = selected) {
    setActive(index);
    setOpen(true);
  }

  function choose(index) {
    onChange({ target: { value: options[index].value } });
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft || 0;
      const topEdge = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const below = Math.max(0, topEdge + height - rect.bottom - 12);
      const above = Math.max(0, rect.top - topEdge - 12);
      const up = below < Math.min(options.length * 44 + 8, 320) && above > below;
      const maxHeight = Math.min(320, up ? above : below);
      setPosition({
        left: Math.max(leftEdge + 8, Math.min(rect.left, leftEdge + width - Math.min(rect.width, width - 16) - 8)),
        width: Math.min(rect.width, width - 16),
        maxHeight,
        top: up ? undefined : rect.bottom + 4,
        bottom: up ? window.innerHeight - rect.top + 4 : undefined,
      });
    }
    function outside(event) {
      if (!trigger.current?.contains(event.target) && !list.current?.contains(event.target)) close();
    }
    function focusOutside(event) {
      if (!trigger.current?.contains(event.target) && !list.current?.contains(event.target)) close();
    }
    place();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (open && position) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, position]);

  function keyDown(event) {
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape") { if (open) { event.preventDefault(); close(true); } return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : selected); return; }
      if (event.key === "Enter" || event.key === " ") { choose(active); return; }
      setActive(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (active + (event.key === "ArrowUp" ? -1 : 1) + options.length) % options.length);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      search.current = { text: (now - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase(), time: now };
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(search.current.text));
      if (index >= 0) { event.preventDefault(); if (!open) show(index); else setActive(index); }
    }
  }

  return (
    <div className={styles.root}>
      <button {...props} ref={trigger} type="button" className={`input ${styles.trigger}`} role="combobox"
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={keyDown} onClick={() => open ? close() : show()}>
        <span>{options[selected]?.label}</span><span aria-hidden="true">⌄</span>
      </button>
      <ViewportPortal>
        {open && position && <div ref={list} id={id} role="listbox" aria-label={props["aria-label"]}
          className={styles.list} style={position}>
          {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option"
            aria-selected={value === option.value} data-index={index} data-active={index === active}
            className={styles.option} onPointerMove={() => setActive(index)}
            onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
            <span>{option.label}</span><span aria-hidden="true">{value === option.value ? "✓" : ""}</span>
          </div>)}
        </div>}
      </ViewportPortal>
    </div>
  );
}
