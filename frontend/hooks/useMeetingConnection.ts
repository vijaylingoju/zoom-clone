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
  handRaised: boolean;
  stream: MediaStream | null;
}

export interface FloatingReaction {
  key: string;
  participantId: string;
  emoji: string;
}

interface RosterEntry {
  participant_id: string;
  display_name: string;
  role: string;
  is_muted: boolean;
  is_video_off: boolean;
  hand_raised?: boolean;
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
    handRaised: Boolean(entry.hand_raised),
    stream: null,
  };
}

export interface RoomEventHandlers {
  onForceMute?: () => void;
  onRemoved?: () => void;
  onMeetingEnded?: () => void;
}

/**
 * Observer seam (PLAN §2.2): signaling events + PeerManager callbacks flow in,
 * plain serializable React state flows out. Components never see WebRTC objects.
 */
export function useMeetingConnection(
  code: string,
  participant: Participant | null,
  localStream: MediaStream | null,
  handlers: RoomEventHandlers = {},
) {
  // ref so changing handlers never tears down the connection
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
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
        case "reaction": {
          if (!message.from) break;
          const { emoji } = message.payload as { emoji: string };
          const key = `${message.from}-${Date.now()}-${Math.random()}`;
          setReactions((prev) => [...prev, { key, participantId: message.from as string, emoji }]);
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.key !== key)), 4000);
          break;
        }
        case "raise-hand": {
          if (!message.from) break;
          const { raised } = message.payload as { raised: boolean };
          setPeers((prev) =>
            prev[message.from as string]
              ? {
                  ...prev,
                  [message.from as string]: {
                    ...prev[message.from as string],
                    handRaised: raised,
                  },
                }
              : prev,
          );
          break;
        }
        case "force-mute":
          handlersRef.current.onForceMute?.();
          break;
        case "removed":
          handlersRef.current.onRemoved?.();
          break;
        case "meeting-ended":
          handlersRef.current.onMeetingEnded?.();
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
      active = false;
      unsubscribe();
      peerManager.closeAll();
      signaling.close();
      signalingRef.current = null;
      peerManagerRef.current = null;
      setPeers({});
      setChatMessages([]);
      setReactions([]);
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

  const muteAll = useCallback(() => {
    signalingRef.current?.send({ type: "host-mute-all" });
  }, []);

  const removeParticipant = useCallback((participantId: string) => {
    signalingRef.current?.send({
      type: "host-remove",
      payload: { participant_id: participantId },
    });
  }, []);

  const endMeetingForAll = useCallback(() => {
    signalingRef.current?.send({ type: "end-meeting" });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    signalingRef.current?.send({ type: "reaction", payload: { emoji } });
  }, []);

  const setHandRaised = useCallback((raised: boolean) => {
    signalingRef.current?.send({ type: "raise-hand", payload: { raised } });
  }, []);

  const replaceTrack = useCallback(async (track: MediaStreamTrack) => {
    await peerManagerRef.current?.replaceLocalTrack(track);
  }, []);

  return {
    peers: Object.values(peers),
    chatMessages,
    reactions,
    sendMediaState,
    sendChat,
    setVideoOverride,
    replaceTrack,
    sendReaction,
    setHandRaised,
    muteAll,
    removeParticipant,
    endMeetingForAll,
  };
}
