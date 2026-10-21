"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowDownRight, FiBarChart2, FiBox, FiPackage, FiTag, FiTruck, FiX } from 'react-icons/fi';
import { api, getToken } from '@/lib/api';
import { buildChatUpdates, updateAccess } from '@/lib/chatUpdates';
import { readUpdateSnapshot, recentUpdateRead, updateReadKey, UPDATE_FRESH_MS } from '@/lib/chatUpdateCache';

const icons = { price: FiArrowDownRight, discount: FiTag, new: FiPackage, stock: FiBox, inventory: FiBox, sales: FiBarChart2, order: FiTruck };
const TOOLTIP_INTERVAL_MS = 20000;
const TOOLTIP_VISIBLE_MS = 7000;

/** Rotating, evidence-backed speech bubble anchored to the closed support launcher. */
export default function ChatUpdates({ user, enabled, paused, aiMessages = [], onDismiss }) {
  const [now, setNow] = useState(() => Date.now());
  const [visible, setVisible] = useState(true);
  const [focused, setFocused] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const [snapshots, setSnapshots] = useState({});
  const [turn, setTurn] = useState(0);
  const [showing, setShowing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const access = updateAccess(user);
  const active = Boolean(enabled && user?.id && visible && focused && !paused && !interacting);
  useEffect(() => {
    const visibility = () => { setNow(Date.now()); setVisible(document.visibilityState === 'visible'); };
    const focus = () => { setNow(Date.now()); setFocused(true); }, blur = () => setFocused(false);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', focus); window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focus); window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let disposed = false, timer;
    const scope = getToken() || 'guest';
    const sources = [
      ['catalogue', 'api/product-pagination', { per_page: 50, page: 1 }, true],
      ['orders', 'api/account/orders', { per_page: 3 }, true],
      ['inventory', 'api/admin/inventory/variants', { filter: 'all', per_page: 100, page: 1 }, access.inventory],
      ['sales', 'api/admin/sales-report', { status: 'delivered', sort: 'quantity' }, access.sales],
    ];
    const refresh = async () => {
      const next = {};
      await Promise.all(sources.map(async ([name, path, params, allowed]) => {
        if (!allowed || disposed) return;
        const key = updateReadKey(path, params);
        // Recent catalogue/order pages already loaded by the website are safe subsets to reuse.
        const cached = readUpdateSnapshot(scope, key) || (name === 'catalogue' || name === 'orders' ? recentUpdateRead(scope, path) : null);
        if (cached && Date.now() - cached.at < UPDATE_FRESH_MS) { next[name] = cached; return; }
        try {
          await api.get(path, { params });
          next[name] = readUpdateSnapshot(scope, key);
        } catch { /* Omit a failed source; other updates and the original chat remain usable. */ }
      }));
      if (!disposed && getToken() === scope) {
        setNow(Date.now());
        setSnapshots(next);
        timer = setTimeout(refresh, UPDATE_FRESH_MS);
      }
    };
    refresh();
    return () => { disposed = true; clearTimeout(timer); };
  }, [active, user?.id, access.inventory, access.sales]);

  const aiProducts = aiMessages.filter(m => m.role === 'assistant' && now - m.createdAt <= 300000).flatMap(m => (m.products || []).map(p => ({ ...p, observedAt: m.createdAt })));
  const cards = buildChatUpdates({ ...snapshots, inventory: access.inventory ? snapshots.inventory : null, sales: access.sales ? snapshots.sales : null, aiProducts }, now);
  const current = cards[turn % cards.length];
  const cycleActive = Boolean(enabled && user?.id && visible && focused && !paused);
  useEffect(() => {
    setShowing(false);
    setLeaving(false);
    if (!cycleActive) return undefined;
    let showTimer, exitTimer, hideTimer;
    const show = () => {
      setNow(Date.now());
      setLeaving(false);
      setShowing(true);
      exitTimer = setTimeout(() => setLeaving(true), TOOLTIP_VISIBLE_MS - 180);
      hideTimer = setTimeout(() => {
        setShowing(false);
        setLeaving(false);
        setInteracting(false);
        setTurn(value => value + 1);
        // Starts are 20 seconds apart: seven visible, then thirteen hidden.
        showTimer = setTimeout(show, TOOLTIP_INTERVAL_MS - TOOLTIP_VISIBLE_MS);
      }, TOOLTIP_VISIBLE_MS);
    };
    showTimer = setTimeout(show, TOOLTIP_INTERVAL_MS);
    return () => { clearTimeout(showTimer); clearTimeout(exitTimer); clearTimeout(hideTimer); };
  }, [cycleActive]);

  if (!enabled || !user?.id || !current || !showing) return null;
  const Icon = icons[current.kind] || FiPackage;
  return (
    <div className="chat-update-slot chat-update-tooltip" role="region" aria-label="Store updates" aria-live="off"
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false); }}>
      <button type="button" className="chat-update-dismiss" aria-label="Dismiss store updates" onClick={onDismiss}><FiX aria-hidden="true" /></button>
      <div key={current.id} className={`chat-update${leaving ? ' is-leaving' : ''}`}>
        <span className="chat-update-icon" aria-hidden="true"><Icon /></span>
        <div className="chat-update-copy">
          <span className="chat-update-label">Store update <span>{cards.indexOf(current) + 1}/{cards.length}</span></span>
          <Link href={current.href} className="chat-update-title">{current.title}</Link>
          <p title={current.description}>{current.description}</p>
          <small>Checked {new Date(current.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
        </div>
      </div>
    </div>
  );
}
