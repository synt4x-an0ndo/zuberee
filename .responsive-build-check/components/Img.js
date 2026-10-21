"use client";

import Image from "next/image";

/**
 * Thin wrapper over next/image for backend-hosted media. Images are served as-is
 * (unoptimized) because the backend host is configured at runtime, not at build time.
 */
export default function Img({ src, alt = "", fill = false, width = 800, height = 1000, className, priority = false, sizes, style, onError }) {
  if (!src) return null;
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        priority={priority}
        sizes={sizes || "(max-width: 760px) 50vw, 25vw"}
        className={className}
        style={style}
        onError={onError}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      priority={priority}
      sizes={sizes}
      className={className}
      style={style}
      onError={onError}
    />
  );
}
