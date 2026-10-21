"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import ViewportPortal from "@/components/ViewportPortal";
import styles from "./ResponsiveSelect.module.css";

function childOptions(children, groupDisabled = false) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === "option") return [{ value: child.props.value ?? child.props.children, label: child.props.children, disabled: groupDisabled || child.props.disabled }];
    return childOptions(child.props.children, groupDisabled || child.props.disabled);
  });
}
function textLabel(label) {
  if (typeof label === "string" || typeof label === "number") return String(label);
  return Children.toArray(label).map((part) => isValidElement(part) ? textLabel(part.props.children) : String(part)).join("");
}

/** Shared single-select UI. Retain a native form control for real change events,
 * FormData, disabled/required semantics and reset, but never open its OS popup. */
export default function ResponsiveSelect({ className = "", options = [], placeholder, children,
  value, defaultValue, onChange, disabled, required, name, id, form, onInvalid,
  onKeyDown, onClick, ...props }) {
  const generatedId = useId();
  const listId = `${generatedId}-options`;
  const items = [
    ...(placeholder !== undefined ? [{ value: "", label: placeholder }] : []),
    ...options,
    ...childOptions(children),
  ].map((option) => ({ ...option, value: String(option.value ?? "") }));
  const initialValue = String(defaultValue ?? items.find((option) => !option.disabled)?.value ?? "");
  const [internalValue, setInternalValue] = useState(initialValue);
  const currentValue = String(value !== undefined ? value : internalValue);
  const matched = items.findIndex((option) => option.value === currentValue);
  const selected = matched >= 0 ? matched : items.findIndex((option) => !option.disabled);
  const trigger = useRef(null);
  const native = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const search = useRef({ text: "", time: 0 });
  const enabled = items.flatMap((item, index) => item.disabled ? [] : [index]);

  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  function show(index = selected) {
    if (disabled) return;
    setActive(enabled.includes(index) ? index : enabled[0] ?? -1);
    setPosition(null);
    setOpen(true);
  }
  function choose(index) {
    const option = items[index];
    if (disabled || !option || option.disabled) return;
    if (native.current && currentValue !== option.value) {
      native.current.value = option.value;
      // React receives a real select change event, preserving event.target,
      // currentTarget, name, string values and existing caller callbacks.
      native.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close(true);
  }

  useEffect(() => {
    const owner = native.current?.form;
    function reset() { setInternalValue(initialValue); setOpen(false); }
    owner?.addEventListener("reset", reset);
    return () => owner?.removeEventListener("reset", reset);
  }, [initialValue, form]);

  useEffect(() => {
    if (!open || disabled) return;
    function place() {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft || 0;
      const y = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      // Close when a scrolling container has carried the field off screen.
      if (rect.bottom < y || rect.top > y + height || rect.right < x || rect.left > x + width) { setOpen(false); return; }
      const below = Math.max(0, y + height - rect.bottom - 12);
      const above = Math.max(0, rect.top - y - 12);
      const up = below < Math.min(items.length * 44 + 8, 320) && above > below;
      const popupWidth = Math.min(rect.width, width - 16);
      setPosition({
        left: Math.max(x + 8, Math.min(rect.left, x + width - popupWidth - 8)),
        width: popupWidth,
        maxHeight: Math.min(320, up ? above : below),
        top: up ? undefined : rect.bottom + 4,
        bottom: up ? window.innerHeight - rect.top + 4 : undefined,
      });
    }
    function outside(event) {
      if (!trigger.current?.contains(event.target) && !list.current?.contains(event.target)) setOpen(false);
    }
    function scroll(event) { if (!list.current?.contains(event.target)) place(); }
    place();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (trigger.current) observer?.observe(trigger.current);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      observer?.disconnect();
    };
  }, [open, disabled, items.length]);

  useEffect(() => {
    if (!open || !position) return;
    const option = list.current?.querySelector(`[data-index="${active}"]`);
    const container = list.current;
    if (!option || !container) return;
    // Scroll this list only, never the page or an enclosing table/dialog.
    if (option.offsetTop < container.scrollTop) container.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > container.scrollTop + container.clientHeight) container.scrollTop = option.offsetTop + option.offsetHeight - container.clientHeight;
  }, [active, open, position]);

  function keyDown(event) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape") {
      if (open) { event.preventDefault(); event.stopPropagation(); close(true); }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1) : selected); return; }
      if (event.key === "Enter" || event.key === " ") { choose(active); return; }
      const next = (enabled.indexOf(active) + (event.key === "ArrowUp" ? -1 : 1) + enabled.length) % enabled.length;
      setActive(event.key === "Home" ? enabled[0] ?? -1 : event.key === "End" ? enabled.at(-1) ?? -1 : enabled[next] ?? -1);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      search.current = { text: (now - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase(), time: now };
      const index = items.findIndex((option) => !option.disabled && textLabel(option.label).toLowerCase().startsWith(search.current.text));
      if (index >= 0) { event.preventDefault(); if (!open) show(index); else setActive(index); }
    }
  }

  return (
    <>
      <button {...props} id={id} ref={trigger} type="button" disabled={disabled}
        className={`input select ${className} ${styles.trigger}`} role="combobox"
        aria-haspopup="listbox" aria-expanded={open && !disabled} aria-controls={open && !disabled ? listId : undefined}
        aria-required={required || undefined} aria-activedescendant={open && active >= 0 && !disabled ? `${listId}-${active}` : undefined}
        onKeyDown={keyDown} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) { if (open) close(); else show(); } }}>
        <span title={textLabel(items[selected]?.label ?? "")}>{items[selected]?.label ?? ""}</span>
      </button>
      <select ref={native} className={styles.native} tabIndex={-1} aria-hidden="true" name={name} form={form}
        {...(value === undefined ? { defaultValue: initialValue } : { value: currentValue })} disabled={disabled} required={required}
        onInvalid={(event) => { event.preventDefault(); onInvalid?.(event); trigger.current?.focus(); show(); }}
        onChange={(event) => { setInternalValue(event.target.value); onChange?.(event); }}>
        {items.map((option, index) => <option key={`${option.value}-${index}`} value={option.value} disabled={option.disabled}>{textLabel(option.label)}</option>)}
      </select>
      <ViewportPortal>
        {open && !disabled && position && <div ref={list} id={listId} role="listbox"
          aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"] || (!props["aria-label"] ? id : undefined)}
          className={styles.list} style={position} onClick={(event) => event.stopPropagation()}>
          {items.length === 0 && <div className={styles.empty}>No options available</div>}
          {items.map((option, index) => <div key={`${option.value}-${index}`} id={`${listId}-${index}`} role="option"
            aria-selected={currentValue === option.value} aria-disabled={option.disabled || undefined}
            data-index={index} data-active={index === active} className={styles.option}
            onPointerMove={() => { if (!option.disabled) setActive(index); }}
            onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
            <span>{option.label}</span><span aria-hidden="true">{currentValue === option.value ? "✓" : ""}</span>
          </div>)}
        </div>}
      </ViewportPortal>
    </>
  );
}
