import { ICE_SERVERS } from "./iceServers";

export interface PeerManagerEvents {
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerConnectionLost: (peerId: string) => void;
  onConnectionFailed?: (peerId: string) => void;
}

type SendSignal = (type: "offer" | "answer" | "ice-candidate", to: string, payload: unknown) => void;

interface PeerState {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Perfect-negotiation role: the polite peer rolls back on offer glare. */
  polite: boolean;
  /** Candidates that arrived before setRemoteDescription. */
  pendingCandidates: RTCIceCandidateInit[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Facade over the mesh of RTCPeerConnections (PLAN §2.2). React never touches
 * a peer connection: it provides the local stream and receives remote streams.
 * Production swap: replace this class with an SFU client behind the same events.
 */
export class PeerManager {
  private peers = new Map<string, PeerState>();
  /** One accumulated stream per peer — ontrack fires once per track. */
  private remoteStreams = new Map<string, MediaStream>();
  /** Screen-share track currently replacing the camera, if any. */
  private videoOverride: MediaStreamTrack | null = null;

  constructor(
    private selfId: string,
    private localStream: MediaStream | null,
    private send: SendSignal,
    private events: PeerManagerEvents,
    private iceServers: RTCIceServer[] = ICE_SERVERS,
  ) {}

  /**
   * Swap the outgoing video for every peer (screen share on / off).
   * Uses RTCRtpSender.replaceTrack — no renegotiation when a video sender
   * already exists; falls back to addTrack (renegotiates) when it doesn't.
   */
  async setVideoOverride(track: MediaStreamTrack | null): Promise<void> {
    this.videoOverride = track;
    const target = track ?? this.localStream?.getVideoTracks()[0] ?? null;
    for (const [peerId, peer] of this.peers) {
      const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(target);
      } else if (target) {
        peer.pc.addTrack(target, this.localStream ?? new MediaStream([target]));
      }
    }
  }

  /**
   * Swap a local mic/camera track for every peer after a device change.
   * Replaces the matching-kind sender so the change is seamless (no renegotiation).
   */
  async replaceLocalTrack(track: MediaStreamTrack): Promise<void> {
    if (track.kind === "video" && this.videoOverride) return;
    for (const [peerId, peer] of this.peers) {
      const sender = peer.pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        peer.pc.addTrack(track, this.localStream ?? new MediaStream([track]));
      }
    }
  }

  /** Called by the newcomer for every peer already in the room. */
  async connectTo(peerId: string): Promise<void> {
    if (peerId === this.selfId) return;
    this.getOrCreate(peerId);
    if (!this.localStream || this.localStream.getTracks().length === 0) {
      const peer = this.peers.get(peerId);
      if (peer) await this.makeOffer(peerId, peer);
    }
  }

  async handleSignal(from: string, type: string, payload: unknown): Promise<void> {
    const peer = this.getOrCreate(from);
    if (type === "offer") {
      const description = payload as RTCSessionDescriptionInit;
      const offerCollision = peer.makingOffer || peer.pc.signalingState !== "stable";
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;

      if (offerCollision && peer.polite) {
        await peer.pc.setLocalDescription({ type: "rollback" });
      }

      await peer.pc.setRemoteDescription(description);
      await peer.pc.setLocalDescription();
      this.send("answer", from, peer.pc.localDescription?.toJSON());
      await this.flushCandidates(peer);
      return;
    }

    if (type === "answer") {
      const description = payload as RTCSessionDescriptionInit;
      await peer.pc.setRemoteDescription(description);
      await this.flushCandidates(peer);
      return;
    }

    if (type === "ice-candidate") {
      const candidate = payload as RTCIceCandidateInit | null;
      if (!candidate) return;
      if (!peer.pc.remoteDescription) {
        peer.pendingCandidates.push(candidate);
        return;
      }
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch (err) {
        if (!peer.ignoreOffer) throw err;
      }
    }
  }

  /** Tear down and renegotiate — helps peers on strict NAT / relay-only networks. */
  async retryPeer(peerId: string): Promise<void> {
    if (peerId === this.selfId) return;
    const peer = this.peers.get(peerId);
    if (peer?.reconnectTimer) clearTimeout(peer.reconnectTimer);
    this.removePeer(peerId);
    await this.connectTo(peerId);
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.reconnectTimer) clearTimeout(peer.reconnectTimer);
      peer.pc.close();
      this.peers.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
  }

  closeAll(): void {
    this.peers.forEach((peer) => peer.pc.close());
    this.peers.clear();
    this.remoteStreams.clear();
  }

  /** Inbound audio levels from WebRTC stats (0–1). Used for active-speaker UI. */
  async getInboundAudioLevels(): Promise<Map<string, number>> {
    const levels = new Map<string, number>();
    for (const [peerId, peer] of this.peers) {
      try {
        const stats = await peer.pc.getStats();
        for (const report of stats.values()) {
          if (report.type !== "inbound-rtp" || report.kind !== "audio") continue;
          const level = (report as RTCInboundRtpStreamStats).audioLevel;
          if (typeof level === "number") {
            levels.set(peerId, Math.max(levels.get(peerId) ?? 0, level));
          }
        }
      } catch {
        // pc may be closing
      }
    }
    return levels;
  }

  private getOrCreate(peerId: string): PeerState {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });
    const peer: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      polite: this.selfId < peerId,
      pendingCandidates: [],
      reconnectTimer: null,
    };
    this.peers.set(peerId, peer);

    this.localStream?.getAudioTracks().forEach((track) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });
    const videoTrack = this.videoOverride ?? this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      pc.addTrack(videoTrack, this.localStream ?? new MediaStream([videoTrack]));
    }

    pc.onnegotiationneeded = () => void this.makeOffer(peerId, peer);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send("ice-candidate", peerId, event.candidate.toJSON());
      }
    };
    pc.ontrack = (event) => {
      let accumulator = this.remoteStreams.get(peerId);
      if (!accumulator) {
        accumulator = new MediaStream();
        this.remoteStreams.set(peerId, accumulator);
      }
      if (!accumulator.getTracks().some((t) => t.id === event.track.id)) {
        accumulator.addTrack(event.track);
      }
      this.events.onRemoteStream(peerId, new MediaStream(accumulator.getTracks()));
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        if (peer.reconnectTimer) {
          clearTimeout(peer.reconnectTimer);
          peer.reconnectTimer = null;
        }
        return;
      }
      if (state === "failed" || state === "disconnected") {
        if (peer.reconnectTimer) return;
        peer.reconnectTimer = setTimeout(() => {
          peer.reconnectTimer = null;
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            this.events.onConnectionFailed?.(peerId);
            void this.retryPeer(peerId);
          }
        }, state === "failed" ? 1500 : 5000);
      } else if (state === "closed") {
        this.events.onPeerConnectionLost(peerId);
      }
    };
    return peer;
  }

  private async flushCandidates(peer: PeerState): Promise<void> {
    if (!peer.pc.remoteDescription) return;
    const pending = peer.pendingCandidates.splice(0);
    for (const candidate of pending) {
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch {
        // stale candidates after renegotiation — safe to ignore
      }
    }
  }

  private async makeOffer(peerId: string, peer: PeerState): Promise<void> {
    if (peer.makingOffer || peer.pc.signalingState !== "stable") return;
    try {
      peer.makingOffer = true;
      await peer.pc.setLocalDescription();
      this.send("offer", peerId, peer.pc.localDescription?.toJSON());
    } catch {
      // negotiation restarts via the next onnegotiationneeded
    } finally {
      peer.makingOffer = false;
    }
  }
}
