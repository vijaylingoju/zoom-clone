function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
  );
}

/** Backend origin for REST and WebSocket. LAN hostname swap is dev-only. */
export function getBackendUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) {
    try {
      const url = new URL(configured);
      url.hostname = window.location.hostname;
      return url.origin;
    } catch {
      return `http://${window.location.hostname}:8010`;
    }
  }

  return configured;
}
