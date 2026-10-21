"use client";

import { useId, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/api";

const WIDTH = 1000;
const HEIGHT = 340;
const TOP = 22;
const BOTTOM = 318;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseLocalDate(value) {
  if (!value) return null;
  const text = String(value);
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matched) return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shortDate(value) {
  const date = parseLocalDate(value);
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : String(value || "");
}

function fullDate(value) {
  const date = parseLocalDate(value);
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : String(value || "");
}

/**
 * The API only returns dates that had a valid order. Fill the dates between
 * the first and last selling day with zeroes so the horizontal axis remains
 * a real calendar axis instead of spacing irregular dates evenly.
 */
function completeDailySeries(points) {
  const sorted = (Array.isArray(points) ? points : [])
    .filter((point) => point?.date)
    .map((point) => ({
      date: String(point.date).slice(0, 10),
      sales: Math.max(0, Number(point.sales) || 0),
      orders: Math.max(0, Number(point.orders) || 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return sorted;

  const byDate = new Map(sorted.map((point) => [point.date, point]));
  const start = parseLocalDate(sorted[0].date);
  const end = parseLocalDate(sorted[sorted.length - 1].date);
  if (!start || !end) return sorted;

  const dayCount = Math.round((end - start) / 86400000) + 1;
  if (dayCount < 1 || dayCount > 732) return sorted;

  const complete = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = dateKey(date);
    complete.push(byDate.get(key) || { date: key, sales: 0, orders: 0 });
  }
  return complete;
}

function chartSeries(daily) {
  if (daily.length <= 120) return daily.map((point) => ({ ...point, endDate: point.date }));
  const weekly = [];
  for (let index = 0; index < daily.length; index += 7) {
    const slice = daily.slice(index, index + 7);
    weekly.push({
      date: slice[0].date,
      endDate: slice[slice.length - 1].date,
      sales: slice.reduce((sum, point) => sum + point.sales, 0),
      orders: slice.reduce((sum, point) => sum + point.orders, 0),
      weekly: true,
    });
  }
  return weekly;
}

const TICK_STEPS = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000];

/**
 * Y-axis in clean ৳5k-family steps (5k, 10k, 15k, 20k, 25k, ...). The step
 * grows through the same 5-based family when sales get large so the axis
 * never shows more than about six intervals.
 */
function axisScale(maxSales) {
  const raw = Number.isFinite(maxSales) && maxSales > 0 ? maxSales * 1.05 : 0;
  const step = TICK_STEPS.find((candidate) => raw / candidate <= 6) || TICK_STEPS[TICK_STEPS.length - 1];
  const axisMax = Math.max(step, Math.ceil(raw / step) * step);
  const tickValues = [];
  for (let value = axisMax; value >= 0; value -= step) tickValues.push(value);
  return { axisMax, tickValues };
}

function compactMoney(value) {
  const amount = Math.abs(Number(value) || 0);
  const trim = (number) => number.toFixed(number >= 10 ? 0 : 1).replace(/\.0$/, "");
  if (amount >= 10000000) return `৳${trim(amount / 10000000)}cr`;
  if (amount >= 100000) return `৳${trim(amount / 100000)}L`;
  if (amount >= 1000) return `৳${trim(amount / 1000)}k`;
  return formatMoney(amount);
}

const roundCoord = (value) => Math.round(value * 10) / 10;

const clampY = (value) => Math.min(BOTTOM, Math.max(TOP, value));

/**
 * Catmull-Rom to cubic Bezier control points for one segment, so the trend
 * flows as a smooth curve through every data point. Control Y values are
 * clamped to the plot area so the curve never dips below the baseline.
 */
function segmentControls(coords, index) {
  const current = coords[index];
  const next = coords[index + 1];
  const previous = coords[index - 1] || current;
  const following = coords[index + 2] || next;
  return {
    c1: {
      x: current.x + (next.x - previous.x) / 6,
      y: clampY(current.y + (next.y - previous.y) / 6),
    },
    c2: {
      x: next.x - (following.x - current.x) / 6,
      y: clampY(next.y - (following.y - current.y) / 6),
    },
  };
}

function cubicPoint(p0, c1, c2, p1, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

function linePathFromCoords(coords) {
  if (coords.length === 0) return "";
  if (coords.length === 1) {
    const point = coords[0];
    const startX = Math.max(0, point.x - 115);
    const endX = Math.min(WIDTH, point.x + 115);
    return `M ${roundCoord(startX)} ${roundCoord(point.y)} L ${roundCoord(endX)} ${roundCoord(point.y)}`;
  }
  let path = `M ${roundCoord(coords[0].x)} ${roundCoord(coords[0].y)}`;
  for (let index = 0; index < coords.length - 1; index += 1) {
    const { c1, c2 } = segmentControls(coords, index);
    const next = coords[index + 1];
    path += ` C ${roundCoord(c1.x)} ${roundCoord(c1.y)}, ${roundCoord(c2.x)} ${roundCoord(
      c2.y
    )}, ${roundCoord(next.x)} ${roundCoord(next.y)}`;
  }
  return path;
}

function buildSegments(coords) {
  if (coords.length === 0) return [];
  if (coords.length === 1) {
    const point = coords[0];
    const startX = Math.max(0, point.x - 115);
    const endX = Math.min(WIDTH, point.x + 115);
    return [
      {
        key: `segment-${point.date}`,
        points: `${roundCoord(startX)},${roundCoord(point.y)} ${roundCoord(endX)},${roundCoord(point.y)} ${roundCoord(endX)},${BOTTOM} ${roundCoord(startX)},${BOTTOM}`,
      },
    ];
  }

  const spacing = WIDTH / Math.max(1, coords.length - 1);
  const gap = Math.min(18, Math.max(2, spacing * 0.055));
  const SAMPLES = 14;
  return coords.slice(0, -1).map((point, index) => {
    const next = coords[index + 1];
    const span = Math.max(1, next.x - point.x);
    const startX = point.x + (index === 0 ? 0 : gap / 2);
    const endX = next.x - (index === coords.length - 2 ? 0 : gap / 2);
    const t0 = Math.min(1, Math.max(0, (startX - point.x) / span));
    const t1 = Math.min(1, Math.max(0, (endX - point.x) / span));
    const { c1, c2 } = segmentControls(coords, index);
    const top = [];
    let firstPoint = null;
    let lastPoint = null;
    for (let step = 0; step <= SAMPLES; step += 1) {
      const t = t0 + ((t1 - t0) * step) / SAMPLES;
      const sampled = cubicPoint(point, c1, c2, next, t);
      if (!firstPoint) firstPoint = sampled;
      lastPoint = sampled;
      top.push(`${roundCoord(sampled.x)},${roundCoord(sampled.y)}`);
    }
    return {
      key: `segment-${point.date}-${next.date}`,
      points: `${top.join(" ")} ${roundCoord(lastPoint.x)},${BOTTOM} ${roundCoord(firstPoint.x)},${BOTTOM}`,
    };
  });
}

function tickIndexes(length, maximum = 6) {
  if (length <= maximum) return Array.from({ length }, (_, index) => index);
  const step = Math.ceil((length - 1) / (maximum - 1));
  const indexes = [];
  for (let index = 0; index < length; index += step) indexes.push(index);
  if (indexes[indexes.length - 1] !== length - 1) indexes.push(length - 1);
  return indexes;
}

export default function SalesTrendChart({ points }) {
  const plotRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const model = useMemo(() => {
    const daily = completeDailySeries(points);
    const series = chartSeries(daily);
    const totalSales = daily.reduce((sum, point) => sum + point.sales, 0);
    const totalOrders = daily.reduce((sum, point) => sum + point.orders, 0);
    const peak = daily.reduce((best, point) => (!best || point.sales > best.sales ? point : best), null);
    const activeDays = daily.filter((point) => point.sales > 0).length;
    const average = daily.length ? totalSales / daily.length : 0;
    const maxSales = Math.max(...series.map((point) => point.sales), 0);
    const { axisMax, tickValues } = axisScale(maxSales);
    const yFor = (value) => TOP + (1 - Math.min(Math.max(value, 0), axisMax) / axisMax) * (BOTTOM - TOP);
    const coords = series.map((point, index) => {
      const x = series.length === 1 ? WIDTH / 2 : 30 + (index / (series.length - 1)) * (WIDTH - 60);
      const y = yFor(point.sales);
      return { ...point, index, x, y, xPercent: (x / WIDTH) * 100, yPercent: (y / HEIGHT) * 100 };
    });
    const linePath = linePathFromCoords(coords);
    const segments = buildSegments(coords);
    const peakCoord = coords.reduce((best, point) => (!best || point.sales > best.sales ? point : best), null);

    return {
      daily,
      series,
      coords,
      linePath,
      segments,
      totalSales,
      totalOrders,
      peak,
      peakCoord,
      activeDays,
      average,
      axisMax,
      ticks: tickValues.map((value) => ({
        ratio: axisMax > 0 ? value / axisMax : 0,
        value,
        y: yFor(value),
      })),
    };
  }, [points]);

  if (!model.daily.length) {
    return (
      <div className="sales-trend-empty">
        <EmptyState title="No sales yet" text="Sales will chart here once orders come in." />
      </div>
    );
  }

  const displayIndex = hoverIndex ?? model.coords.length - 1;
  const active = model.coords[displayIndex] || model.coords[model.coords.length - 1];
  const first = model.daily[0];
  const last = model.daily[model.daily.length - 1];
  const xTicks = tickIndexes(model.coords.length);
  const showDots = model.coords.length <= 62;
  const tooltipBelow = active && active.yPercent < 28;
  const tooltipTransform = !active
    ? undefined
    : active.xPercent < 18
      ? `translate(0, ${tooltipBelow ? "16px" : "calc(-100% - 16px)"})`
      : active.xPercent > 82
        ? `translate(-100%, ${tooltipBelow ? "16px" : "calc(-100% - 16px)"})`
        : `translate(-50%, ${tooltipBelow ? "16px" : "calc(-100% - 16px)"})`;

  const updateHover = (event) => {
    const plot = plotRef.current;
    if (!plot || model.coords.length === 0) return;
    const rect = plot.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const pointerX = ratio * WIDTH;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    model.coords.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setHoverIndex(nearestIndex);
  };

  const onKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setHoverIndex((current) => {
      const base = current ?? model.coords.length - 1;
      return Math.min(model.coords.length - 1, Math.max(0, base + direction));
    });
  };

  return (
    <div className="sales-trend-chart">
      <div className="sales-trend-head">
        <div className="sales-trend-total">
          <span>Total revenue</span>
          <strong>{formatMoney(model.totalSales)}</strong>
          <small>{shortDate(first.date)} — {shortDate(last.date)}</small>
        </div>
        <dl className="sales-trend-metrics" aria-label="Sales trend summary">
          <div>
            <dt>Peak day</dt>
            <dd>{compactMoney(model.peak?.sales || 0)}</dd>
            <small>{shortDate(model.peak?.date)}</small>
          </div>
          <div>
            <dt>Daily average</dt>
            <dd>{compactMoney(model.average)}</dd>
            <small>{model.daily.length} days</small>
          </div>
          <div title="Non-cancelled orders included in revenue">
            <dt>Valid orders</dt>
            <dd>{model.totalOrders}</dd>
            <small>Excludes cancelled</small>
          </div>
        </dl>
      </div>

      <div className="sales-trend-canvas">
        <div className="sales-trend-yaxis" aria-hidden="true">
          {model.ticks.map((tick) => (
            <span key={tick.ratio} style={{ bottom: `${((HEIGHT - tick.y) / HEIGHT) * 100}%` }}>
              {compactMoney(tick.value)}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          className="sales-trend-plot"
          role="img"
          tabIndex={0}
          aria-label={`Revenue from ${fullDate(first.date)} to ${fullDate(last.date)}. Total ${formatMoney(model.totalSales)} across ${model.totalOrders} orders. Use left and right arrow keys to inspect points.`}
          onPointerMove={updateHover}
          onPointerDown={updateHover}
          onPointerLeave={() => setHoverIndex(null)}
          onFocus={() => setHoverIndex(model.coords.length - 1)}
          onBlur={() => setHoverIndex(null)}
          onKeyDown={onKeyDown}
        >
          {model.ticks.map((tick) => (
            <span
              key={tick.ratio}
              className={`sales-trend-gridline${tick.ratio === 0 ? " is-baseline" : ""}`}
              style={{ bottom: `${((HEIGHT - tick.y) / HEIGHT) * 100}%` }}
              aria-hidden="true"
            />
          ))}

          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={`${rawId}-columns`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--brand) 66%, #ffb15c)" }} stopOpacity="0.94" />
                <stop offset="24%" stopColor="var(--brand)" stopOpacity="0.80" />
                <stop offset="58%" stopColor="var(--brand)" stopOpacity="0.42" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id={`${rawId}-line`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--brand)" />
                <stop offset="58%" stopColor="var(--brand)" />
                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--brand) 60%, #ffb15c)" }} />
              </linearGradient>
              <radialGradient id={`${rawId}-ambient`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.16" />
                <stop offset="48%" stopColor="var(--brand)" stopOpacity="0.05" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="510" cy="185" rx="410" ry="170" fill={`url(#${rawId}-ambient)`} className="sales-trend-ambient" />

            {model.segments.map((segment) => (
              <polygon
                key={segment.key}
                points={segment.points}
                fill={`url(#${rawId}-columns)`}
                className="sales-trend-column"
              />
            ))}

            <path d={model.linePath} pathLength="1" className="sales-trend-line-aura" vectorEffect="non-scaling-stroke" />
            <path d={model.linePath} pathLength="1" className="sales-trend-line-glow" vectorEffect="non-scaling-stroke" />
            <path d={model.linePath} pathLength="1" stroke={`url(#${rawId}-line)`} className="sales-trend-line" vectorEffect="non-scaling-stroke" />
          </svg>

          {showDots && model.coords.map((point) => (
            <span
              key={`dot-${point.date}`}
              className={`sales-trend-dot${point.index === model.peakCoord?.index ? " is-peak" : ""}`}
              style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
              aria-hidden="true"
            />
          ))}

          {!showDots && model.peakCoord && (
            <span
              className="sales-trend-dot is-peak"
              style={{ left: `${model.peakCoord.xPercent}%`, top: `${model.peakCoord.yPercent}%` }}
              aria-hidden="true"
            />
          )}

          {active && (
            <>
              <span className="sales-trend-crosshair" style={{ left: `${active.xPercent}%` }} aria-hidden="true" />
              <span className={`sales-trend-active-dot${hoverIndex === null ? " is-latest" : ""}`} style={{ left: `${active.xPercent}%`, top: `${active.yPercent}%` }} aria-hidden="true" />
            </>
          )}

          {active && hoverIndex !== null && (
            <div
              className={`sales-trend-tooltip${tooltipBelow ? " is-below" : ""}`}
              style={{ left: `${active.xPercent}%`, top: `${active.yPercent}%`, transform: tooltipTransform }}
              role="status"
            >
              <span>{active.weekly ? `${shortDate(active.date)} — ${shortDate(active.endDate)}` : fullDate(active.date)}</span>
              <strong>{formatMoney(active.sales)}</strong>
              <small>{active.orders} {active.orders === 1 ? "order" : "orders"}</small>
            </div>
          )}
        </div>

        <div className="sales-trend-xaxis" aria-hidden="true">
          {xTicks.map((index) => {
            const point = model.coords[index];
            const align = index === 0 ? " is-first" : index === model.coords.length - 1 ? " is-last" : "";
            return (
              <span key={`${point.date}-${index}`} className={align.trim()} style={{ left: `${point.xPercent}%` }}>
                {shortDate(point.date)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="sales-trend-foot">
        <span><i aria-hidden="true" />Gross sales</span>
        <span>{model.series.some((point) => point.weekly) ? "Grouped weekly for readability" : "Daily revenue"}</span>
      </div>
    </div>
  );
}
