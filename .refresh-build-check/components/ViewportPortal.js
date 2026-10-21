"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Escape animated/transformed/overflow-clipped page ancestors without changing dialog behavior. */
export default function ViewportPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? createPortal(children, document.body) : null;
}
