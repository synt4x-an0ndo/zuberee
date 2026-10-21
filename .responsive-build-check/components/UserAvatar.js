"use client";

import { useState } from "react";
import Img from "@/components/Img";
import { avatarSrc, DEFAULT_AVATAR } from "@/lib/avatar";

function AvatarImage({ src, style, ...props }) {
  const [failed, setFailed] = useState(false);
  const resolved = failed ? DEFAULT_AVATAR : src;
  return (
    <Img {...props} src={resolved}
      style={{ objectFit: "cover", borderRadius: "50%", display: "block", flexShrink: 0, ...style }}
      onError={() => { if (resolved !== DEFAULT_AVATAR) setFailed(true); }} />
  );
}

/** A custom image wins; missing/deleted files fall back to the built-in avatar. */
export default function UserAvatar({ image, ...props }) {
  const src = avatarSrc(image);
  // A changed upload gets a fresh error state, including after a previous 404.
  return <AvatarImage key={src} src={src} {...props} />;
}
