import { useEffect, useRef, useState } from "react";

interface DealMeterProps {
  score: number;
}

type Tier = "bad" | "fair" | "good";

const TIER_CONFIG: Record<Tier, { label: string; color: string; angle: number }> = {
  bad:  { label: "Bad Deal",  color: "#dc2626", angle: -60 },
  fair: { label: "Fair Deal", color: "#d97706", angle: 0 },
  good: { label: "Good Deal", color: "#16a34a", angle: 60 },
};

/* Map exact scores from scoreDeal() → 3-tier bucket
   scoreDeal returns: 20 (bad), 50 (fair), 70 (good), 90 (great)
   We collapse great + good → "good" for the 3-tier display */
function getTier(score: number): Tier {
  if (score === 20) return "bad";
  if (score === 50) return "fair";
  return "good"; // 70 or 90
}

/* Segment arc paths (semicircle split into 3 equal zones) */
const SEGMENTS: { d: string; tier: Tier; muted: string; active: string }[] = [
  {
    tier: "bad",
    d: "M 20 95 A 80 80 0 0 1 66.7 25.7",
    muted: "#fca5a5",
    active: "#ef4444",
  },
  {
    tier: "fair",
    d: "M 72 23.5 A 80 80 0 0 1 128 23.5",
    muted: "#fde68a",
    active: "#f59e0b",
  },
  {
    tier: "good",
    d: "M 133.3 25.7 A 80 80 0 0 1 180 95",
    muted: "#86efac",
    active: "#22c55e",
  },
];

export default function DealMeter({ score }: DealMeterProps) {
  const tier = getTier(score);
  const config = TIER_CONFIG[tier];
  const needleRef = useRef<SVGGElement>(null);
  const [animated, setAnimated] = useState(false);

  /* Animate needle from -90° to target on mount / score change */
  useEffect(() => {
    setAnimated(false);
    const el = needleRef.current;
    if (!el) return;
    // Reset to start position
    el.style.transition = "none";
    el.style.transform = "rotate(-90deg)";
    // Force reflow
    void el.getBoundingClientRect();
    // Kick off animation
    const raf = requestAnimationFrame(() => {
      setAnimated(true);
      el.style.transition = "transform 1.2s cubic-bezier(0.34, 1.4, 0.64, 1)";
      el.style.transform = `rotate(${config.angle}deg)`;
    });
    return () => cancelAnimationFrame(raf);
  }, [score, config.angle]);

  return (
    <div className="flex flex-col items-center">
      <svg
        width="200"
        height="115"
        viewBox="0 0 200 115"
        className="block"
      >
        {/* Arc segments */}
        {SEGMENTS.map((seg) => (
          <path
            key={seg.tier}
            d={seg.d}
            stroke={seg.tier === tier ? seg.active : seg.muted}
            strokeWidth="12"
            fill="none"
            strokeLinecap={seg.tier !== "fair" ? "round" : undefined}
            opacity={seg.tier === tier ? 0.85 : 1}
          />
        ))}

        {/* Needle */}
        <g
          ref={needleRef}
          style={{
            transformOrigin: "100px 95px",
            transform: "rotate(-90deg)",
          }}
        >
          <line
            x1="100"
            y1="95"
            x2="100"
            y2="20"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Center dot */}
        <circle cx="100" cy="95" r="6" fill="#1a1a1a" />
        <circle cx="100" cy="95" r="3" fill="#fff" />
      </svg>

      {/* Tier labels under the arc */}
      <div className="flex justify-between w-[180px] mt-0.5 text-[11px] text-muted-foreground font-medium">
        <span>Bad</span>
        <span>Fair</span>
        <span>Good</span>
      </div>

      {/* Deal verdict */}
      <p
        className="text-xl font-bold mt-2"
        style={{ color: config.color }}
      >
        {config.label}
      </p>
    </div>
  );
}
