import { useLocation, Link } from "react-router-dom";
import { useRef, useCallback, useId } from "react";
import { cn } from "@/lib/utils";

interface GooeyNavLinkProps {
  to: string;
  label: string;
}

export function GooeyNavLink({ to, label }: GooeyNavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || (to === "/" && location.pathname === "/");
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number | null>(null);
  const filterId = useId().replace(/:/g, "");

  const stopAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (text1Ref.current) {
      text1Ref.current.style.filter = "";
      text1Ref.current.style.opacity = "100%";
    }
    if (text2Ref.current) {
      text2Ref.current.style.filter = "";
      text2Ref.current.style.opacity = "0%";
    }
  }, []);

  const startAnim = useCallback(() => {
    if (animRef.current) return;

    let morph = 0;
    const morphTime = 0.6;
    let time = performance.now();
    let forward = true;

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current) {
        // text2 fades in
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
        // text1 fades out
        const inv = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / inv - 8, 100)}px)`;
        text1Ref.current.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;
      }
    };

    function animate(now: number) {
      const dt = (now - time) / 1000;
      time = now;

      if (forward) {
        morph += dt;
        const fraction = Math.min(morph / morphTime, 1);
        setMorph(fraction);
        if (fraction >= 1) {
          forward = false;
        }
      } else {
        morph -= dt;
        const fraction = Math.max(morph / morphTime, 0);
        setMorph(fraction);
        if (fraction <= 0) {
          forward = true;
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
  }, []);

  return (
    <Link
      to={to}
      onMouseEnter={startAnim}
      onMouseLeave={stopAnim}
      className={cn(
        "relative pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        isActive && "text-foreground border-b-2 border-foreground"
      )}
    >
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
      <span style={{ filter: `url(#${filterId})` }} className="relative inline-block">
        <span ref={text1Ref} className="inline-block">
          {label}
        </span>
        <span
          ref={text2Ref}
          className="absolute left-0 top-0 inline-block"
          style={{ opacity: "0%" }}
          aria-hidden="true"
        >
          {label}
        </span>
      </span>
    </Link>
  );
}
