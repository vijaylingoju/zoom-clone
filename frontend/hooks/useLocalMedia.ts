"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaPermission = "pending" | "granted" | "denied" | "unavailable" | "skipped";

export interface LocalMedia {
  stream: MediaStream | null;
  permission: MediaPermission;
  audioEnabled: boolean;
  videoEnabled: boolean;
  hasVideoTrack: boolean;
  /** Ask for devices (Zoom's "Use microphone and camera"). */
  acquire: () => Promise<void>;
  /** Join without devices (Zoom's "Continue without microphone and camera"). */
  skip: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  stop: () => void;
}

/**
 * Owns the local getUserMedia stream. Acquisition is explicit (the pre-join
 * permission card decides), with video+audio → video → audio fallbacks.
 */
export function useLocalMedia(): LocalMedia {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permission, setPermission] = useState<MediaPermission>("pending");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  const acquire = useCallback(async () => {
    const attempts: MediaStreamConstraints[] = [
      { video: true, audio: true },
      { video: true, audio: false },
      { video: false, audio: true },
    ];
    for (const constraints of attempts) {
      try {
        const media = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = media;
        setStream(media);
        setPermission("granted");
        setVideoEnabled(media.getVideoTracks().length > 0);
        setAudioEnabled(media.getAudioTracks().length > 0);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setPermission("denied");
          return;
        }
        // NotFoundError etc. — try the next constraint set
      }
    }
    setPermission("unavailable");
  }, []);

  const skip = useCallback(() => {
    setPermission("skipped");
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Track mutation must stay OUT of the state updater: React may invoke
  // updaters twice (StrictMode), which silently re-disables the track while
  // the UI reports it enabled. Derive next state from the tracks themselves.
  const toggleAudio = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const next = !tracks.some((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = next;
    });
    setAudioEnabled(next);
  }, []);

  const toggleVideo = useCallback(() => {
    const tracks = streamRef.current?.getVideoTracks() ?? [];
    const next = !tracks.some((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = next;
    });
    setVideoEnabled(next);
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return {
    stream,
    permission,
    audioEnabled,
    videoEnabled,
    hasVideoTrack: (stream?.getVideoTracks().length ?? 0) > 0,
    acquire,
    skip,
    toggleAudio,
    toggleVideo,
    stop,
  };
}
