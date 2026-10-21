"use client";

import { useEffect, useState } from "react";

/** Keep an exiting panel mounted; cancel the removal when quickly reopened. */
export default function useExitPresence(open, duration = 240) {
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open) {
      setRetained(true);
      return undefined;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setRetained(false), reduced ? 0 : duration);
    return () => window.clearTimeout(timer);
  }, [open, duration]);
  return open || retained;
}
