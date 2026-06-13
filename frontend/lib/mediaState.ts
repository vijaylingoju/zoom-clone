import type { LocalMedia } from "@/hooks/useLocalMedia";

/** Read live mute/camera flags from the underlying MediaStream tracks. */
export function readMediaFlags(media: LocalMedia) {
  return media.getLiveFlags();
}
