"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { SignalingClient, signalingUrl } from "@/lib/signaling";
import { PeerManager } from "@/lib/webrtc/PeerManager";
import type { ChatMessage, Participant } from "@/lib/types";

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

function mergeChat(history: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
  const seen = new Set(history.map((m) => m.id));
  return [...history, ...live.filter((m) => !seen.has(m.id))];
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const signalingRef = useRef<SignalingClient | null>(null);
  const peerManagerRef = useRef<PeerManager | null>(null);
  // Ref, not dep: a late-arriving stream must not tear down the connection
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;

  useEffect(() => {
    if (!participant) return;

    let active = true;
    api
      .chatHistory(code)
      .then((history) => {
        if (active) setChatMessages((live) => mergeChat(history, live));
      })
      .catch(() => {
        // history is best-effort; live messages still arrive over WS
      });

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
    peerManagerRef.current = peerManager;

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
        case "chat": {
          const incoming = message.payload as ChatMessage;
          setChatMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
          break;
        }
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
      active = false;
      unsubscribe();
      peerManager.closeAll();
      signaling.close();
      signalingRef.current = null;
      peerManagerRef.current = null;
      setPeers({});
      setChatMessages([]);
    };
  }, [code, participant]);

  const sendMediaState = useCallback((audio: boolean, video: boolean) => {
    signalingRef.current?.send({ type: "media-state", payload: { audio, video } });
  }, []);

  const sendChat = useCallback((content: string) => {
    signalingRef.current?.send({ type: "chat", payload: { content } });
  }, []);

  const setVideoOverride = useCallback(async (track: MediaStreamTrack | null) => {
    await peerManagerRef.current?.setVideoOverride(track);
  }, []);

  return {
    peers: Object.values(peers),
    chatMessages,
    sendMediaState,
    sendChat,
    setVideoOverride,
  };
}
