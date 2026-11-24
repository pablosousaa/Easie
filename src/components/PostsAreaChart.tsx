"use client";

import { useId, useMemo, useState } from "react";
import type { DayBucket } from "@/lib/reports";

type Props = {
  days: DayBucket[];
  /** Accessible name for the chart. */
  label?: string;
};

type Point = {
  date: string;
  label: string;
  count: number;
  x: number;
  y: number;
};

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 32, left: 8 };

function buildPath(points: Point[], close: boolean): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    const baseY = H - PAD.bottom;
    if (!close) return `M ${p.x} ${p.y}`;
    return `M ${p.x} ${baseY} L ${p.x} ${p.y} L ${p.x} ${baseY} Z`;
  }

  // Smooth monotone-ish cubic through points
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  if (close) {
    const first = points[0];
    const last = points[points.length - 1];
    const baseY = H - PAD.bottom;
    d += ` L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }
  return d;
}

export function PostsAreaChart({ days, label = "Posts por dia" }: Props) {
  const gradId = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);

  const { points, maxCount } = useMemo(() => {
    const max = Math.max(1, ...days.map((d) => d.count));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = Math.max(1, days.length - 1);
    const pts: Point[] = days.map((d, i) => {
      const x = PAD.left + (i / n) * innerW;
      const y = PAD.top + innerH * (1 - d.count / max);
      return { ...d, x, y };
    });
    return { points: pts, maxCount: max };
  }, [days]);

  const linePath = useMemo(() => buildPath(points, false), [points]);
  const areaPath = useMemo(() => buildPath(points, true), [points]);

  const activePoint = active != null ? points[active] : null;
  const tipX = activePoint
    ? Math.min(Math.max(activePoint.x, 56), W - 56)
    : 0;

  return (
    <div className="posts-chart">
      <div className="posts-chart__head">
        <p className="posts-chart__range">Últimos 7 dias</p>
        <p className="posts-chart__meta" aria-hidden>
          Pico {maxCount}
        </p>
      </div>

      <div
        className="posts-chart__canvas"
        onMouseLeave={() => setActive(null)}
      >
        <svg
          className="posts-chart__svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={label}
        >
          <defs>
            <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--neon)"
                stopOpacity="0.28"
              />
              <stop
                offset="70%"
                stopColor="var(--neon)"
                stopOpacity="0.06"
              />
              <stop
                offset="100%"
                stopColor="var(--neon)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {/* Baseline only — no grid clutter */}
          <line
            className="posts-chart__baseline"
            x1={PAD.left}
            y1={H - PAD.bottom}
            x2={W - PAD.right}
            y2={H - PAD.bottom}
          />

          <path
            className="posts-chart__area"
            d={areaPath}
            fill={`url(#fill-${gradId})`}
          />
          <path
            className="posts-chart__line"
            d={linePath}
            fill="none"
            stroke="var(--neon)"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => {
            const slot =
              (W - PAD.left - PAD.right) / Math.max(1, points.length - 1);
            const hitW = points.length === 1 ? 48 : slot;
            const hitX =
              points.length === 1 ? p.x - hitW / 2 : p.x - slot / 2;
            return (
              <g key={p.date}>
                <circle
                  className={
                    active === i
                      ? "posts-chart__dot posts-chart__dot--active"
                      : "posts-chart__dot"
                  }
                  cx={p.x}
                  cy={p.y}
                  r={active === i ? 4.5 : 0}
                />
                <text
                  className="posts-chart__tick"
                  x={p.x}
                  y={H - 10}
                  textAnchor="middle"
                >
                  {p.label}
                </text>
                <rect
                  className="posts-chart__hit"
                  x={hitX}
                  y={PAD.top}
                  width={hitW}
                  height={H - PAD.top - PAD.bottom}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive((cur) => (cur === i ? null : i))}
                  onFocus={() => setActive(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label}: ${p.count} post${p.count === 1 ? "" : "s"}`}
                  aria-pressed={active === i}
                />
              </g>
            );
          })}

          {activePoint ? (
            <line
              className="posts-chart__guide"
              x1={activePoint.x}
              y1={PAD.top}
              x2={activePoint.x}
              y2={H - PAD.bottom}
            />
          ) : null}
        </svg>

        {activePoint ? (
          <div
            className="posts-chart__tooltip"
            style={{
              left: `${(tipX / W) * 100}%`,
              top: `${((activePoint.y - 12) / H) * 100}%`,
            }}
            role="tooltip"
          >
            <span className="posts-chart__tooltip-label">{activePoint.label}</span>
            <span className="posts-chart__tooltip-value">
              {activePoint.count}{" "}
              {activePoint.count === 1 ? "post" : "posts"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
