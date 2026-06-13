import { getBackendUrl } from "../backendUrl";
import { ICE_SERVERS } from "./iceServers";

let cached: RTCIceServer[] | null = null;

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  if (cached) return cached;

  try {
    const res = await fetch(`${getBackendUrl()}/api/ice-servers`);
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
