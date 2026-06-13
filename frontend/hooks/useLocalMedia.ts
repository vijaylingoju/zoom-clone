"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

export type MediaPermission = "pending" | "granted" | "denied" | "unavailable" | "skipped";

export interface MediaBootstrap {
  stream: MediaStream | null;
  permission: MediaPermission;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  currentAudioId: string | null;
  currentVideoId: string | null;
}

interface UseLocalMediaOptions {
  /** When true on unmount, camera/mic tracks stay alive (meeting pop-out). */
  keepAliveRef?: MutableRefObject<boolean>;
  /** Pre-join snapshot — session starts with live devices immediately. */
  bootstrap?: MediaBootstrap;
}

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
  toggleAudio: () => Promise<MediaStreamTrack | null>;
  /** Stop/start camera hardware; returns new video track or null when off. */
  toggleVideo: () => Promise<MediaStreamTrack | null>;
  /** Switch mic/camera; returns the new track so peers can replaceTrack. */
  switchDevice: (kind: "audio" | "video", deviceId: string) => Promise<MediaStreamTrack | null>;
  /** Take over devices acquired on the pre-join page. */
  adopt: (bootstrap: MediaBootstrap) => void;
  /** Current mute/camera from stream tracks (safe to call right after toggle). */
  getLiveFlags: () => {
    audioEnabled: boolean;
    videoEnabled: boolean;
    hasAudioTrack: boolean;
    hasVideoTrack: boolean;
  };
  stop: () => void;
}

/**
 * Owns the local getUserMedia stream. Acquisition is explicit (the pre-join
 * permission card decides), with video+audio → video → audio fallbacks.
 */
export function useLocalMedia(options: UseLocalMediaOptions = {}): LocalMedia {
  const { keepAliveRef, bootstrap } = options;
  const ownsStreamRef = useRef(!bootstrap);
  const [stream, setStream] = useState<MediaStream | null>(bootstrap?.stream ?? null);
  const [permission, setPermission] = useState<MediaPermission>(bootstrap?.permission ?? "pending");
  const [audioEnabled, setAudioEnabled] = useState(bootstrap?.audioEnabled ?? true);
  const [videoEnabled, setVideoEnabled] = useState(bootstrap?.videoEnabled ?? true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>(bootstrap?.audioDevices ?? []);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>(bootstrap?.videoDevices ?? []);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(bootstrap?.currentAudioId ?? null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(bootstrap?.currentVideoId ?? null);
  const streamRef = useRef<MediaStream | null>(bootstrap?.stream ?? null);

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
    let lastErrorName: string | null = null;

    for (const constraints of attempts) {
      try {
        const acquired = await navigator.mediaDevices.getUserMedia(constraints);
        const hasVideo = acquired.getVideoTracks().length > 0;
        const hasAudio = acquired.getAudioTracks().length > 0;
        streamRef.current = acquired;
        setStream(acquired);
        setPermission(hasAudio || hasVideo ? "granted" : "unavailable");
        ownsStreamRef.current = true;
        setVideoEnabled(hasVideo);
        setAudioEnabled(hasAudio);
        setCurrentAudioId(acquired.getAudioTracks()[0]?.getSettings().deviceId ?? null);
        setCurrentVideoId(acquired.getVideoTracks()[0]?.getSettings().deviceId ?? null);
        await refreshDevices();
        return;
      } catch (err) {
        if (err instanceof DOMException) {
          lastErrorName = err.name;
        }
      }
    }

    if (lastErrorName === "NotAllowedError") setPermission("denied");
    else setPermission("unavailable");
  }, [refreshDevices]);

  const skip = useCallback(() => {
    setPermission("skipped");
  }, []);

  useEffect(() => {
    return () => {
      if (keepAliveRef?.current) return;
      if (!ownsStreamRef.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [keepAliveRef]);

  const toggleAudio = useCallback(async (): Promise<MediaStreamTrack | null> => {
    const current = streamRef.current;
    const audioTracks = current?.getAudioTracks() ?? [];

    if (audioTracks.length === 0) {
      try {
        const constraints: MediaStreamConstraints = currentAudioId
          ? { audio: { deviceId: { exact: currentAudioId } } }
          : { audio: true };
        const fresh = await navigator.mediaDevices.getUserMedia(constraints);
        fresh.getVideoTracks().forEach((track) => track.stop());
        const newTrack = fresh.getAudioTracks()[0];
        if (!newTrack) return null;

        if (current) {
          current.addTrack(newTrack);
          const next = new MediaStream(current.getTracks());
          streamRef.current = next;
          setStream(next);
        } else {
          streamRef.current = fresh;
          setStream(fresh);
          ownsStreamRef.current = true;
        }
        setAudioEnabled(true);
        setPermission("granted");
        setCurrentAudioId(newTrack.getSettings().deviceId ?? currentAudioId);
        await refreshDevices();
        return newTrack;
      } catch {
        return null;
      }
    }

    const next = !audioTracks.some((track) => track.enabled);
    audioTracks.forEach((track) => {
      track.enabled = next;
    });
    setAudioEnabled(next);
    return next ? audioTracks[0]! : null;
  }, [currentAudioId, refreshDevices]);

  const toggleVideo = useCallback(async (): Promise<MediaStreamTrack | null> => {
    const current = streamRef.current;

    if (!current) {
      try {
        const constraints: MediaStreamConstraints = currentVideoId
          ? { video: { deviceId: { exact: currentVideoId } } }
          : { video: true };
        const fresh = await navigator.mediaDevices.getUserMedia(constraints);
        fresh.getAudioTracks().forEach((track) => track.stop());
        const newTrack = fresh.getVideoTracks()[0];
        if (!newTrack) return null;
        streamRef.current = fresh;
        setStream(fresh);
        ownsStreamRef.current = true;
        setVideoEnabled(true);
        setPermission("granted");
        setCurrentVideoId(newTrack.getSettings().deviceId ?? currentVideoId);
        await refreshDevices();
        return newTrack;
      } catch {
        return null;
      }
    }

    const videoTracks = current.getVideoTracks();
    if (videoTracks.length > 0) {
      const next = !videoTracks.some((track) => track.enabled);
      videoTracks.forEach((track) => {
        track.enabled = next;
      });
      setVideoEnabled(next);
      return next ? videoTracks[0]! : null;
    }

    try {
      const constraints: MediaStreamConstraints = currentVideoId
        ? { video: { deviceId: { exact: currentVideoId } } }
        : { video: true };
      const fresh = await navigator.mediaDevices.getUserMedia(constraints);
      fresh.getAudioTracks().forEach((track) => track.stop());
      const newTrack = fresh.getVideoTracks()[0];
      if (!newTrack) return null;

      current.addTrack(newTrack);
      setVideoEnabled(true);
      setPermission("granted");
      setCurrentVideoId(newTrack.getSettings().deviceId ?? currentVideoId);
      const next = new MediaStream(current.getTracks());
      streamRef.current = next;
      setStream(next);
      await refreshDevices();
      return newTrack;
    } catch {
      setVideoEnabled(false);
      return null;
    }
  }, [currentVideoId, refreshDevices]);

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
    if (!ownsStreamRef.current) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    ownsStreamRef.current = false;
  }, []);

  const adopt = useCallback((boot: MediaBootstrap) => {
    streamRef.current = boot.stream;
    setStream(boot.stream);
    setPermission(boot.permission);
    setAudioEnabled(boot.audioEnabled);
    setVideoEnabled(boot.videoEnabled);
    setAudioDevices(boot.audioDevices);
    setVideoDevices(boot.videoDevices);
    setCurrentAudioId(boot.currentAudioId);
    setCurrentVideoId(boot.currentVideoId);
    ownsStreamRef.current = false;
  }, []);

  const getLiveFlags = useCallback(() => {
    const current = streamRef.current;
    const hasAudioTrack = (current?.getAudioTracks().length ?? 0) > 0;
    const hasVideoTrack = (current?.getVideoTracks().length ?? 0) > 0;
    const liveAudio = hasAudioTrack
      ? (current!.getAudioTracks().some((track) => track.enabled) ?? false)
      : audioEnabled;
    const liveVideo = hasVideoTrack
      ? (current!.getVideoTracks().some((track) => track.enabled) ?? false)
      : videoEnabled;
    return { audioEnabled: liveAudio, videoEnabled: liveVideo, hasAudioTrack, hasVideoTrack };
  }, [audioEnabled, videoEnabled]);

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
    adopt,
    getLiveFlags,
    stop,
  };
}
