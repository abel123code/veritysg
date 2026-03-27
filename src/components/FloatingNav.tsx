import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function FloatingNav() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const isAdmin = location.pathname === "/admin";

  useEffect(() => {
    if (isAdmin) {
      setVisible(false);
      return;
    }
    if (!isHome) {
      setVisible(true);
      return;
    }

    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome, isAdmin]);

  if (isAdmin) return null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-3">
        <motion.nav
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="pointer-events-auto flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full border border-neutral-300/60 bg-gradient-to-b from-neutral-100/90 to-neutral-200/80 px-1.5 py-1 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-md"
        >
          {/* Logo — same visual weight as inactive tabs; only Tool/Guide show selected (dark) */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-tight text-neutral-600 transition-colors select-none hover:bg-neutral-300/40 hover:text-neutral-900"
          >
            v.
          </button>

          {/* Divider */}
          <div className="mx-1 h-4 w-px bg-neutral-300/80" />

          {/* Nav buttons */}
          <button
            onClick={() => navigate("/tool")}
            className={`rounded-full px-4 py-1 text-xs font-medium tracking-wide transition-all ${
              location.pathname === "/tool"
                ? "bg-neutral-800 text-neutral-100 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300/40"
            }`}
          >
            Tool
          </button>
          <button
            onClick={() => navigate("/guide")}
            className={`rounded-full px-4 py-1 text-xs font-medium tracking-wide transition-all ${
              location.pathname === "/guide"
                ? "bg-neutral-800 text-neutral-100 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300/40"
            }`}
          >
            Guide
          </button>
        </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}