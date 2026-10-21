// Small session-memory observation cache. No persistence, API contract changes or synthetic events.
const paths = new Set(['api/product-pagination', 'api/account/orders', 'api/admin/inventory/variants', 'api/admin/sales-report']);
const entries = new Map();
const pending = new Map();
let generation = 0;
export const UPDATE_FRESH_MS = 120000;
export const UPDATE_MAX_AGE_MS = 300000;
export function updateReadKey(path, params = {}) {
  const url = new URL(String(path).replace(/^\/+/, ''), 'https://local.invalid/');
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  url.searchParams.sort();
  return url.pathname.slice(1) + url.search;
}
export function clearUpdateReads() { generation++; entries.clear(); pending.clear(); }
export function readUpdateSnapshot(scope, key) { return entries.get(scope + '|' + key); }
export function recentUpdateRead(scope, path) {
  return [...entries.entries()].filter(([key, e]) => key.startsWith(scope + '|' + path + '?') && Date.now() - e.at < UPDATE_FRESH_MS)
    .map(([, e]) => e).sort((a, b) => b.at - a.at)[0];
}
export function observeUpdateRead(scope, path, params, load) {
  const key = updateReadKey(path, params);
  if (!paths.has(key.split('?')[0]) || typeof window === 'undefined') return load();
  const id = scope + '|' + key;
  if (pending.has(id)) return pending.get(id);
  const version = generation;
  const promise = load().then(data => {
    if (version !== generation || data?.success === false || data?.message === 'failed') return data;
    const prior = entries.get(id), at = Date.now();
    const same = prior && JSON.stringify(prior.data) === JSON.stringify(data);
    entries.set(id, { data, at, previous: same ? prior.previous : prior ? { data: prior.data, at: prior.at } : null, key });
    if (entries.size > 32) entries.delete(entries.keys().next().value);
    return data;
  }).finally(() => { if (pending.get(id) === promise) pending.delete(id); });
  pending.set(id, promise);
  return promise;
}
