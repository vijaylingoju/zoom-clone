"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SignalingClient, signalingUrl } from "@/lib/signaling";
import { PeerManager } from "@/lib/webrtc/PeerManager";
import type { Participant } from "@/lib/types";

export interface RemotePeer {
  id: string;
  name: string;
  role: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream: MediaStream | null;
}

interface RosterEntry {
  participant_id: string;
  display_name: string;
  role: string;
  is_muted: boolean;
  is_video_off: boolean;
}

function toRemotePeer(entry: RosterEntry): RemotePeer {
  return {
    id: entry.participant_id,
    name: entry.display_name,
    role: entry.role,
    audioEnabled: !entry.is_muted,
    videoEnabled: !entry.is_video_off,
    stream: null,
  };
}

/**
 * Observer seam (PLAN §2.2): signaling events + PeerManager callbacks flow in,
 * plain serializable React state flows out. Components never see WebRTC objects.
 */
export function useMeetingConnection(
  code: string,
  participant: Participant | null,
  localStream: MediaStream | null,
) {
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const signalingRef = useRef<SignalingClient | null>(null);
  // Ref, not dep: a late-arriving stream must not tear down the connection
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;

  useEffect(() => {
    if (!participant) return;

    const signaling = new SignalingClient(signalingUrl(code, participant.id));
    signalingRef.current = signaling;

    const peerManager = new PeerManager(
      participant.id,
      localStreamRef.current,
      (type, to, payload) => signaling.send({ type, to, payload }),
      {
        onRemoteStream: (peerId, stream) =>
          setPeers((prev) =>
            prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], stream } } : prev,
          ),
        onPeerConnectionLost: (peerId) =>
          setPeers((prev) =>
            prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], stream: null } } : prev,
          ),
      },
    );

    const unsubscribe = signaling.onMessage((message) => {
      switch (message.type) {
        case "roster": {
          const entries = (message.payload as { participants: RosterEntry[] }).participants;
          setPeers(Object.fromEntries(entries.map((e) => [e.participant_id, toRemotePeer(e)])));
          // the newcomer initiates offers toward everyone already present
          entries.forEach((entry) => void peerManager.connectTo(entry.participant_id));
          break;
        }
        case "participant-joined": {
          const entry = message.payload as RosterEntry;
          setPeers((prev) => ({ ...prev, [entry.participant_id]: toRemotePeer(entry) }));
          break;
        }
        case "participant-left": {
          const { participant_id } = message.payload as { participant_id: string };
          peerManager.removePeer(participant_id);
          setPeers((prev) => {
            const next = { ...prev };
            delete next[participant_id];
            return next;
          });
          break;
        }
        case "offer":
        case "answer":
        case "ice-candidate":
          if (message.from) {
            void peerManager.handleSignal(message.from, message.type, message.payload);
          }
          break;
        case "media-state": {
          if (!message.from) break;
          const { audio, video } = message.payload as { audio: boolean; video: boolean };
          setPeers((prev) =>
            prev[message.from as string]
              ? {
                  ...prev,
                  [message.from as string]: {
                    ...prev[message.from as string],
                    audioEnabled: audio,
                    videoEnabled: video,
                  },
                }
              : prev,
          );
          break;
        }
      }
    });

    signaling.connect();

    return () => {
      unsubscribe();
      peerManager.closeAll();
      signaling.close();
      signalingRef.current = null;
      setPeers({});
    };
  }, [code, participant]);

  const sendMediaState = useCallback((audio: boolean, video: boolean) => {
    signalingRef.current?.send({ type: "media-state", payload: { audio, video } });
  }, []);

  return { peers: Object.values(peers), sendMediaState };
}
