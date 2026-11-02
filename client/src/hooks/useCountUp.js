import { useEffect, useState } from "react";

/**
 * Animates a number from 0 to `target` on mount / target change.
 * Respects the reduced-motion preference.
 */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || end === 0) {
      const resetFrame = requestAnimationFrame(() =>
        setValue(end)
      );
      return () => cancelAnimationFrame(resetFrame);
    }

    let frame = 0;
    const startedAt = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
