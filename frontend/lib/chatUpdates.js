import { formatMoney } from '@/lib/api';
import { UPDATE_MAX_AGE_MS } from '@/lib/chatUpdateCache';

const DAY = 86400000;
const number = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const array = value => Array.isArray(value) ? value : [];
const effective = p => { const price = number(p.price), sale = number(p.discount); return price === null ? null : sale !== null && sale > 0 && sale < price ? sale : price; };
const productLink = id => `/product-page/${encodeURIComponent(id)}`;
export function updateAccess(user) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return {
    inventory: user?.role === 'admin' && permissions.includes('manage inventory'),
    sales: user?.role === 'admin' && permissions.includes('view dashboard summary'),
  };
}
export function buildChatUpdates({ catalogue, orders, inventory, sales, aiProducts = [] }, now = Date.now()) {
  const cards = [];
  const add = (id, entity, kind, title, description, href, priority, at) => cards.push({ id, entity, kind, title, description, href, priority, at });
  const fresh = entry => entry && now - entry.at <= UPDATE_MAX_AGE_MS;
  const previous = entry => entry.previous && now - entry.previous.at < 15 * 60000 ? entry.previous.data : null;
  if (fresh(catalogue)) {
    const rows = array(catalogue.data?.data), old = new Map(array(previous(catalogue)?.data).map(p => [p.id, p]));
    for (const p of rows) {
      if (!p.id || !p.title) continue;
      const entity = `product:${p.id}`, href = productLink(p.id), was = old.get(p.id), price = effective(p), prior = was ? effective(was) : null;
      if (price !== null && prior !== null && price !== prior) {
        add(`price:${p.id}:${price}`, entity, 'price', price < prior ? 'Price drop' : 'Price updated', `${p.title}: ${formatMoney(prior)} → ${formatMoney(price)} since the last check.`, href, price < prior ? 95 : 70, catalogue.at);
      } else if (was && number(p.price) !== null && number(was.price) !== null && number(p.price) !== number(was.price)) {
        add(`base:${p.id}:${p.price}`, entity, 'price', 'Price updated', `${p.title}: list price ${formatMoney(was.price)} → ${formatMoney(p.price)} since the last check.`, href, 70, catalogue.at);
      }
      if (was && price !== null && number(p.discount) !== number(was.discount) && (price < number(p.price) || effective(was) < number(was.price))) {
        const offered = number(p.discount) > 0 && number(p.discount) < number(p.price);
        add(`discount:${p.id}:${p.discount}`, entity, 'discount', 'Discount updated', `${p.title}: ${offered ? `current offer ${formatMoney(price)}` : `offer ended; current price ${formatMoney(price)}`}.`, href, 80, catalogue.at);
      }
      if (price !== null && price < number(p.price)) add(`offer:${p.id}`, entity, 'discount', 'Current offer', `${p.title}: ${formatMoney(price)} (list price ${formatMoney(p.price)}).`, href, 40, catalogue.at);
      const created = Date.parse(p.created_at);
      if (Number.isFinite(created) && created <= now && now - created <= 7 * DAY) add(`new:${p.id}`, entity, 'new', 'New product', `${p.title} · added ${new Date(created).toLocaleDateString('en-GB')}${price !== null ? ` · ${formatMoney(price)}` : ''}.`, href, 45, catalogue.at);
      if (p.status === 'out-of-stock') add(`unavailable:${p.id}`, entity, 'stock', 'Out of stock', `${p.title} is currently marked out of stock.`, href, 60, catalogue.at);
    }
  }
  if (fresh(inventory)) {
    const rows = array(inventory.data?.data?.data), old = new Map(array(previous(inventory)?.data?.data).map(v => [v.id, v]));
    for (const v of rows) {
      if (!v.is_active || v.product?.track_inventory !== true || !v.product?.title) continue;
      const available = number(v.available), stock = number(v.stock), was = old.get(v.id), prior = was ? number(was.available) : null;
      if (available === null) continue;
      const label = `${v.product.title}${v.label?.trim() ? ` (${v.label.trim()})` : ''}`, entity = `variant:${v.id}`, href = productLink(v.product_id);
      if (available <= 0 && !v.allow_preorder) add(`out:${v.id}`, entity, 'stock', 'Out of stock', `${label}: ${available} available.`, href, 85, inventory.at);
      else if (v.low_stock === true && available > 0) add(`low:${v.id}:${available}`, entity, 'stock', 'Low stock alert', `${label}: ${available} available.`, href, 90, inventory.at);
      if (was && prior === 0 && available > 0 && v.product.status === 'in-stock') add(`back:${v.id}:${available}`, entity, 'inventory', 'Back in stock', `${label}: available stock changed from 0 to ${available} since the last check.`, href, 96, inventory.at);
      else if (was && stock !== null && number(was.stock) !== null && stock !== number(was.stock)) add(`inventory:${v.id}:${stock}`, entity, 'inventory', stock > number(was.stock) ? 'Stock increased' : 'Inventory update', `${label}: on-hand stock ${was.stock} → ${stock} since the last check.`, href, 75, inventory.at);
    }
  }
  if (fresh(orders)) {
    const old = new Map(array(previous(orders)?.data).map(o => [o.id, o]));
    const labels = { pending: 'pending', confirmed: 'confirmed', processing: 'being prepared', shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled' };
    for (const o of array(orders.data?.data)) {
      const updated = Date.parse(o.updated_at), was = old.get(o.id);
      if (!labels[o.status] || !o.id || !Number.isFinite(updated) || updated > now || now - updated > 7 * DAY) continue;
      add(`order:${o.id}:${o.status}`, `order:${o.id}`, 'order', was && was.status !== o.status ? 'Order updated' : 'Your order', `Order #${o.id} is ${labels[o.status]}.`, '/user/orders', 100, orders.at);
    }
  }
  if (fresh(sales)) {
    const data = sales.data?.data, range = data?.range;
    if (range?.from && range?.to) {
      const period = `${range.from}–${range.to}`;
      const ranked = array(data.products).filter(p => number(p.quantity_sold) > 0 && p.title).sort((a, b) => b.quantity_sold - a.quantity_sold);
      const best = ranked[0];
      if (best?.product_id) add(`best:${best.product_id}`, `product:${best.product_id}`, 'sales', 'Best selling · delivered orders', `${best.title}: ${best.quantity_sold} delivered units, joint or outright highest in ${period}.`, productLink(best.product_id), 55, sales.at);
      const summary = data.summary;
      if (number(summary?.orders) > 0 && number(summary?.units_sold) !== null && number(summary?.gross_sales) !== null) add('sales-summary', 'sales-summary', 'sales', 'Sales highlight · delivered orders', `${summary.orders} delivered orders · ${summary.units_sold} units · ${formatMoney(summary.gross_sales)} order value, ${period}.`, '/admin/sales', 50, sales.at);
    }
  }
  // Existing chatbot cards can verify a current offer, never a historic price drop.
  for (const p of aiProducts) {
    const price = number(p.price), sale = number(p.salePrice);
    if (p.id && p.name && price !== null && sale !== null && sale > 0 && sale < price) add(`ai-offer:${p.id}`, `product:${p.id}`, 'discount', 'Current offer', `${p.name}: ${formatMoney(sale)} (list price ${formatMoney(price)}).`, productLink(p.id), 35, p.observedAt);
  }
  const seen = new Set(), counts = new Map();
  return cards.sort((a, b) => b.priority - a.priority).filter(c => {
    if (seen.has(c.entity) || (counts.get(c.kind) || 0) >= 3) return false;
    seen.add(c.entity); counts.set(c.kind, (counts.get(c.kind) || 0) + 1); return true;
  }).slice(0, 12);
}
