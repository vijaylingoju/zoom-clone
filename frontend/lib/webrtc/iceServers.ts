/**
 * STUN discovers public addresses; TURN relays media when direct P2P fails.
 * Each TURN URL is a separate entry — some browsers apply credentials more reliably.
 */
const OPEN_RELAY_USER = "openrelayproject";
const OPEN_RELAY_CRED = "openrelayproject";

const OPEN_RELAY_URLS = [
  "turn:openrelay.metered.ca:80",
  "turn:openrelay.metered.ca:443",
  "turn:openrelay.metered.ca:443?transport=tcp",
  "turns:openrelay.metered.ca:443",
] as const;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:openrelay.metered.ca:80" },
  ...OPEN_RELAY_URLS.map((url) => ({
    urls: url,
    username: OPEN_RELAY_USER,
    credential: OPEN_RELAY_CRED,
  })),
];
