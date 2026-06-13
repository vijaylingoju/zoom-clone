/**
 * ICE configuration for WebRTC.
 *
 * STUN discovers public addresses; TURN *relays* media when a direct peer-to-peer
 * path can't be punched through NAT (common on mobile data, office/college wifi,
 * and symmetric NATs). Without a working TURN server, ~10–15% of peer pairs fail
 * to exchange audio/video even though signaling/chat work — which looks like
 * "works for some people, not others".
 *
 * Provide your own TURN credentials via the NEXT_PUBLIC_ICE_SERVERS env var
 * (a JSON array of RTCIceServer). Example (.env.local or Vercel project env):
 *
 *   NEXT_PUBLIC_ICE_SERVERS='[
 *     {"urls":"stun:stun.l.google.com:19302"},
 *     {"urls":"turn:YOUR.relay.metered.ca:80","username":"<key>","credential":"<secret>"},
 *     {"urls":"turn:YOUR.relay.metered.ca:443","username":"<key>","credential":"<secret>"},
 *     {"urls":"turns:YOUR.relay.metered.ca:443?transport=tcp","username":"<key>","credential":"<secret>"}
 *   ]'
 *
 * Get free TURN credentials (50 GB/mo, no card) at https://www.metered.ca/tools/openrelay/
 */

const STUN_FALLBACK: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

function parseEnvIceServers(): RTCIceServer[] | null {
  const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[];
  } catch {
    // fall through to STUN-only if the env var is malformed
  }
  return null;
}

export const ICE_SERVERS: RTCIceServer[] = parseEnvIceServers() ?? STUN_FALLBACK;

/** True when at least one TURN server is configured (i.e. relay is possible). */
export const HAS_TURN = ICE_SERVERS.some((s) => {
  const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
  return urls.some((u) => u.startsWith("turn:") || u.startsWith("turns:"));
});
