const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export interface PeerManagerEvents {
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerConnectionLost: (peerId: string) => void;
}

type SendSignal = (type: "offer" | "answer" | "ice-candidate", to: string, payload: unknown) => void;

interface PeerState {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Perfect-negotiation role: the polite peer rolls back on offer glare. */
  polite: boolean;
}

/**
 * Facade over the mesh of RTCPeerConnections (PLAN §2.2). React never touches
 * a peer connection: it provides the local stream and receives remote streams.
 * Production swap: replace this class with an SFU client behind the same events.
 */
export class PeerManager {
  private peers = new Map<string, PeerState>();
  /** Screen-share track currently replacing the camera, if any. */
  private videoOverride: MediaStreamTrack | null = null;

  constructor(
    private selfId: string,
    private localStream: MediaStream | null,
    private send: SendSignal,
    private events: PeerManagerEvents,
  ) {}

  /**
   * Swap the outgoing video for every peer (screen share on / off).
   * Uses RTCRtpSender.replaceTrack — no renegotiation when a video sender
   * already exists; falls back to addTrack (renegotiates) when it doesn't.
   */
  async setVideoOverride(track: MediaStreamTrack | null): Promise<void> {
    this.videoOverride = track;
    const target = track ?? this.localStream?.getVideoTracks()[0] ?? null;
    for (const peer of this.peers.values()) {
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
    // don't clobber an active screen share with a camera device switch
    if (track.kind === "video" && this.videoOverride) return;
    for (const peer of this.peers.values()) {
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
    this.getOrCreate(peerId);
    // onnegotiationneeded fires from addTrack and produces the offer;
    // with no local tracks there is nothing to negotiate yet, so nudge:
    if (!this.localStream || this.localStream.getTracks().length === 0) {
      const peer = this.peers.get(peerId);
      if (peer) await this.makeOffer(peerId, peer);
    }
  }

  async handleSignal(from: string, type: string, payload: unknown): Promise<void> {
    const peer = this.getOrCreate(from);
    if (type === "offer" || type === "answer") {
      const description = payload as RTCSessionDescriptionInit;
      const collision =
        type === "offer" && (peer.makingOffer || peer.pc.signalingState !== "stable");
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;

      await peer.pc.setRemoteDescription(description);
      if (type === "offer") {
        await peer.pc.setLocalDescription();
        this.send("answer", from, peer.pc.localDescription?.toJSON());
      }
    } else if (type === "ice-candidate") {
      try {
        await peer.pc.addIceCandidate((payload as RTCIceCandidateInit) ?? undefined);
      } catch (err) {
        if (!peer.ignoreOffer) throw err;
      }
    }
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.pc.close();
      this.peers.delete(peerId);
    }
  }

  closeAll(): void {
    this.peers.forEach((peer) => peer.pc.close());
    this.peers.clear();
  }

  private getOrCreate(peerId: string): PeerState {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      polite: this.selfId < peerId,
    };
    this.peers.set(peerId, peer);

    this.localStream?.getAudioTracks().forEach((track) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });
    // peers joining mid-share must receive the screen, not the camera
    const videoTrack = this.videoOverride ?? this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      pc.addTrack(videoTrack, this.localStream ?? new MediaStream([videoTrack]));
    }

    pc.onnegotiationneeded = () => void this.makeOffer(peerId, peer);
    pc.onicecandidate = (event) => {
      this.send("ice-candidate", peerId, event.candidate?.toJSON() ?? null);
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.events.onRemoteStream(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.events.onPeerConnectionLost(peerId);
      }
    };
    return peer;
  }

  private async makeOffer(peerId: string, peer: PeerState): Promise<void> {
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
