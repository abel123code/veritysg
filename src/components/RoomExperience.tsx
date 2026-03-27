import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Hotspot {
  id: string;
  x_percent: number;
  y_percent: number;
  mobile_x_percent?: number | null;
  mobile_y_percent?: number | null;
  title: string;
  description: string;
  sort_order: number;
  tactics_label: string;
}

interface RoomExperienceProps {
  title: string;
  imageUrl: string;
  mobileImageUrl?: string;
  hotspots: Hotspot[];
}

export default function RoomExperience({ title, imageUrl, mobileImageUrl, hotspots }: RoomExperienceProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const active = hotspots.find((h) => h.id === activeId) ?? null;
  const resolvedImage = isMobile && mobileImageUrl ? mobileImageUrl : imageUrl;

  return (
    <section className="relative min-h-screen flex flex-col md:flex-row bg-background">
      {/* Image area */}
      <div className="relative flex-1 min-h-[50vh] md:min-h-screen">
        <img
          src={resolvedImage}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-foreground/20" />
        <h2 className="absolute top-6 left-6 text-3xl md:text-4xl font-bold text-primary-foreground z-10 drop-shadow-lg">
          {title}
        </h2>
        {hotspots.map((h) => (
          <button
            key={h.id}
            onClick={() => setActiveId(activeId === h.id ? null : h.id)}
            className="absolute z-10 group"
            style={{ left: `${isMobile && h.mobile_x_percent != null ? h.mobile_x_percent : h.x_percent}%`, top: `${isMobile && h.mobile_y_percent != null ? h.mobile_y_percent : h.y_percent}%`, transform: "translate(-50%,-50%)" }}
            aria-label={h.title}
          >
            <span
              className={`block w-5 h-5 rounded-full border-2 border-primary-foreground transition-all ${
                activeId === h.id
                  ? "bg-primary-foreground scale-125"
                  : "bg-primary-foreground/50 animate-pulse"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Sidebar */}
      <div className="bg-card border-l border-border flex flex-col justify-center p-8 w-full md:w-96">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
          What to know
        </p>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <h3 className="text-2xl font-semibold text-card-foreground mb-3">
                {active.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {active.description}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground"
            >
              Click a hotspot on the image to learn more.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Tactics button — per-hotspot label */}
        {active?.tactics_label ? (
          <button
            onClick={() => navigate("/guide")}
            className="mt-8 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors text-left leading-snug underline underline-offset-2 decoration-muted-foreground/30"
          >
            {active.tactics_label}
          </button>
        ) : null}
      </div>
    </section>
  );
}
