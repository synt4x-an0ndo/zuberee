import { imgUrl } from "@/lib/api";

// Built-in asset supplied by the store owner, also served by the backend.
export const DEFAULT_AVATAR = "/images/default-avatar.png";

export function avatarSrc(image) {
  const value = typeof image === "string" ? image.trim() : "";
  return !value || value === DEFAULT_AVATAR ? DEFAULT_AVATAR : imgUrl(value) || DEFAULT_AVATAR;
}
