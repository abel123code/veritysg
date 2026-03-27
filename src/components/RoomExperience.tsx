import { useState, useRef, useEffect } from "react";
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const active = hotspots.find((h) => h.id === activeId) ?? null;
  // Always use desktop image - mobile image feature disabled for now
  // To re-enable: const resolvedImage = isMobile && mobileImageUrl ? mobileImageUrl : imageUrl;
  const resolvedImage = imageUrl;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setImageDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [imageLoaded]);

  return (
    <section className="relative xl:min-h-screen flex flex-col xl:flex-row bg-background">
      {/* Image area - use aspect ratio on mobile/tablet for proper proportions */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-[4/3] xl:aspect-auto xl:flex-1 xl:min-h-screen overflow-hidden"
      >
        <img
          src={resolvedImage}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
        />
        <div className="absolute inset-0 bg-foreground/20" />
        <h2 className="absolute top-4 left-4 sm:top-5 sm:left-5 xl:top-6 xl:left-6 max-w-[calc(100%-2rem)] text-xl sm:text-2xl md:text-3xl xl:text-4xl font-bold leading-tight text-primary-foreground z-10 drop-shadow-lg">
          {title}
        </h2>
        {/* Hotspot overlay - positioned relative to container */}
        <div className="absolute inset-0 z-10">
          {hotspots.map((h) => {
            const xPos = isMobile && h.mobile_x_percent != null ? h.mobile_x_percent : h.x_percent;
            const yPos = isMobile && h.mobile_y_percent != null ? h.mobile_y_percent : h.y_percent;
            return (
              <button
                key={h.id}
                onClick={() => setActiveId(activeId === h.id ? null : h.id)}
                className="absolute group transition-transform duration-200"
                style={{ 
                  left: `${xPos}%`, 
                  top: `${yPos}%`, 
                  transform: "translate(-50%,-50%)" 
                }}
                aria-label={h.title}
              >
                <span
                  className={`block w-4 h-4 sm:w-5 sm:h-5 xl:w-6 xl:h-6 rounded-full border-2 border-primary-foreground transition-all shadow-lg ${
                    activeId === h.id
                      ? "bg-primary-foreground scale-125"
                      : "bg-primary-foreground/50 animate-pulse hover:scale-110"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar */}
      <div className="bg-card border-t xl:border-t-0 xl:border-l border-border flex flex-col xl:justify-center p-6 xl:p-8 w-full xl:w-96">
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
