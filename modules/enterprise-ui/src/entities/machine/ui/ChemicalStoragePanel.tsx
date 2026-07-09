import { Card } from "@/shared/ui/Card";

// > 50% green · 20–50% amber · < 20% red · 0% grey.
// Returns the liquid body + meniscus (top) colours, or null when empty.
function liquidColors(level: number): { body: string; top: string } | null {
  if (level <= 0) return null;
  if (level < 20) return { body: "#ef4444", top: "#f87171" };
  if (level <= 50) return { body: "#f59e0b", top: "#fbbf24" };
  return { body: "#10b981", top: "#34d399" };
}

function pctTextClass(level: number): string {
  if (level <= 0) return "text-slate-400";
  if (level < 20) return "text-rose-600";
  if (level <= 50) return "text-amber-600";
  return "text-emerald-600";
}

// SVG geometry (viewBox 0 0 46 92): a squat cylinder with elliptical caps.
const RX = 21;
const RY = 7;
const TOP_Y = 7; // centre of the rim ellipse
const BOT_Y = 85; // centre of the base ellipse
const BODY_H = BOT_Y - TOP_Y; // 78

function Cylinder({ index, level }: { index: number; level: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(level)));
  const colors = liquidColors(pct);
  const fillTop = BOT_Y - (pct / 100) * BODY_H; // y of the liquid surface
  const full = pct >= 100;

  const sheenId = `cyl-sheen-${index}`;
  const clipId = `cyl-clip-${index}`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-sm font-semibold text-slate-700">{index}</span>
      <svg viewBox="0 0 46 92" className="h-24 w-12" aria-hidden="true">
        <defs>
          {/* horizontal highlight that gives the body its roundness */}
          <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.32" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="0.78" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
          {/* the cylinder silhouette, used to round the liquid's bottom */}
          <clipPath id={clipId}>
            <rect x="2" y={TOP_Y} width="42" height={BODY_H} />
            <ellipse cx="23" cy={BOT_Y} rx={RX} ry={RY} />
          </clipPath>
        </defs>

        {/* empty glass body */}
        <rect x="2" y={TOP_Y} width="42" height={BODY_H} fill="#f1f5f9" />
        <ellipse cx="23" cy={BOT_Y} rx={RX} ry={RY} fill="#e2e8f0" />

        {/* liquid: rising body + elliptical meniscus, clipped to the silhouette */}
        {colors && (
          <g clipPath={`url(#${clipId})`}>
            <rect
              x="2"
              y={fillTop}
              width="42"
              height={92 - fillTop}
              fill={colors.body}
              style={{ transition: "y 0.4s, height 0.4s" }}
            />
            {!full && (
              <ellipse cx="23" cy={fillTop} rx={RX} ry={RY} fill={colors.top} />
            )}
          </g>
        )}

        {/* glossy sheen over the whole body */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="2"
            y={TOP_Y}
            width="42"
            height={BODY_H}
            fill={`url(#${sheenId})`}
          />
        </g>

        {/* outlines: open rim on top, sides + rounded base */}
        <path
          d={`M2 ${TOP_Y} V${BOT_Y} A${RX} ${RY} 0 0 0 44 ${BOT_Y} V${TOP_Y}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <ellipse
          cx="23"
          cy={TOP_Y}
          rx={RX}
          ry={RY}
          fill={full && colors ? colors.top : "#f8fafc"}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
      </svg>
      <span className={`text-xs font-medium ${pctTextClass(pct)}`}>{pct}%</span>
    </div>
  );
}

export function ChemicalStoragePanel({ levels }: { levels: number[] }) {
  // Always render 8 cylinders even if the device reports fewer.
  const cylinders = Array.from({ length: 8 }, (_, i) => levels[i] ?? 0);
  return (
    <Card title="Chemical Storage">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {cylinders.map((lvl, i) => (
          <Cylinder key={i} index={i + 1} level={lvl} />
        ))}
      </div>
    </Card>
  );
}
