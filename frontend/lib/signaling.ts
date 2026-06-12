export interface SignalMessage {
  type: string;
  from?: string;
  to?: string;
  payload?: unknown;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_RECONNECT_ATTEMPTS = 5;

export function signalingUrl(code: string, participantId: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws/meetings/${code}?participant_id=${encodeURIComponent(participantId)}`;
}

/**
 * Thin WebSocket wrapper: JSON message contract + reconnect with backoff.
 * Production swap: same contract against a dedicated signaling service.
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(message: SignalMessage) => void>();
  private shouldReconnect = true;
  private attempts = 0;

  constructor(private url: string) {}

  connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.attempts = 0;
    };
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SignalMessage;
        this.listeners.forEach((listener) => listener(message));
      } catch {
        // malformed frame — ignore
      }
    };
    this.ws.onclose = () => {
      if (this.shouldReconnect && this.attempts < MAX_RECONNECT_ATTEMPTS) {
        this.attempts += 1;
        setTimeout(() => this.connect(), 500 * 2 ** this.attempts);
      }
    };
  }

  send(message: SignalMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(listener: (message: SignalMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }
}
