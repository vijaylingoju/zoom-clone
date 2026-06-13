import { getBackendUrl } from "../backendUrl";
import { HAS_TURN, ICE_SERVERS } from "./iceServers";

let cached: RTCIceServer[] | null = null;

export function resetIceServerCache(): void {
  cached = null;
}

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  // NEXT_PUBLIC_ICE_SERVERS is inlined at Vercel build time — use it when TURN is present.
  // Do not let the backend's legacy openrelay defaults override working credentials.
  if (HAS_TURN) {
    cached = ICE_SERVERS;
    return ICE_SERVERS;
  }

  try {
    const res = await fetch(`${getBackendUrl()}/api/ice-servers`, { cache: "no-store" });
    if (res.ok) {
      const servers = (await res.json()) as RTCIceServer[];
      if (Array.isArray(servers) && servers.length > 0) {
        cached = servers;
        return servers;
      }
    }
  } catch {
    // offline / backend cold start — fall back to bundled defaults
  }

  cached = ICE_SERVERS;
  return ICE_SERVERS;
}

/** Prefer backend list; used when creating peer connections after a retry. */
export function cachedIceServers(): RTCIceServer[] {
  return cached ?? ICE_SERVERS;
}
