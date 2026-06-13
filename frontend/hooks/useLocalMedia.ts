"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaPermission = "pending" | "granted" | "denied" | "unavailable" | "skipped";

export interface LocalMedia {
  stream: MediaStream | null;
  permission: MediaPermission;
  audioEnabled: boolean;
  videoEnabled: boolean;
  hasVideoTrack: boolean;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  currentAudioId: string | null;
  currentVideoId: string | null;
  /** Ask for devices (Zoom's "Use microphone and camera"). */
  acquire: () => Promise<void>;
  /** Join without devices (Zoom's "Continue without microphone and camera"). */
  skip: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  /** Switch mic/camera; returns the new track so peers can replaceTrack. */
  switchDevice: (kind: "audio" | "video", deviceId: string) => Promise<MediaStreamTrack | null>;
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
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
    } catch {
      // enumeration can fail before permission; ignored
    }
  }, []);

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
        setCurrentAudioId(media.getAudioTracks()[0]?.getSettings().deviceId ?? null);
        setCurrentVideoId(media.getVideoTracks()[0]?.getSettings().deviceId ?? null);
        await refreshDevices(); // labels are populated only after permission
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

  const switchDevice = useCallback(
    async (kind: "audio" | "video", deviceId: string): Promise<MediaStreamTrack | null> => {
      const current = streamRef.current;
      if (!current) return null;
      const constraints: MediaStreamConstraints =
        kind === "audio"
          ? { audio: { deviceId: { exact: deviceId } } }
          : { video: { deviceId: { exact: deviceId } } };
      try {
        const fresh = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = kind === "audio" ? fresh.getAudioTracks()[0] : fresh.getVideoTracks()[0];
        if (!newTrack) return null;
        const oldTracks = kind === "audio" ? current.getAudioTracks() : current.getVideoTracks();
        // preserve mute state: a switched device should stay muted if we were muted
        const wasEnabled = kind === "audio" ? audioEnabled : videoEnabled;
        newTrack.enabled = wasEnabled;
        oldTracks.forEach((t) => {
          current.removeTrack(t);
          t.stop();
        });
        current.addTrack(newTrack);
        if (kind === "audio") setCurrentAudioId(deviceId);
        else setCurrentVideoId(deviceId);
        // new MediaStream identity so dependent effects (preview) re-attach
        const next = new MediaStream(current.getTracks());
        streamRef.current = next;
        setStream(next);
        return newTrack;
      } catch {
        return null;
      }
    },
    [audioEnabled, videoEnabled],
  );

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
    audioDevices,
    videoDevices,
    currentAudioId,
    currentVideoId,
    acquire,
    skip,
    toggleAudio,
    toggleVideo,
    switchDevice,
    stop,
  };
}
