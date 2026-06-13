"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeakerSource {
  id: string;
  stream: MediaStream | null;
  /** Self preview — analyse only, never route to speakers. */
  isSelf?: boolean;
}

interface AudioNodes {
  streamId: string;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  gain: GainNode | null;
}

const SPEAKING_THRESHOLD = 18;
const POLL_MS = 250;

function teardown(entry: AudioNodes): void {
  entry.gain?.disconnect();
  entry.analyser.disconnect();
  entry.source.disconnect();
}

/**
 * Active-speaker detection + remote audio playback through one AudioContext.
 * createMediaStreamSource hijacks a stream on desktop Chrome; routing remote
 * audio to destination here is required for laptop speakers to work.
 */
export function useActiveSpeaker(sources: SpeakerSource[]): {
  activeId: string | null;
  resumeAudio: () => void;
} {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Map<string, AudioNodes>>(new Map());

  const key = sources
    .filter((s) => s.stream && s.stream.getAudioTracks().length > 0)
    .map((s) => `${s.id}:${s.stream!.id}:${s.stream!.getAudioTracks().length}`)
    .sort()
    .join(",");

  const resumeAudio = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = ctxRef.current ?? new AudioCtor();
    ctxRef.current = ctx;
    void ctx.resume();

    const nodes = nodesRef.current;
    const wanted = sources.filter((s) => s.stream && s.stream.getAudioTracks().length > 0);

    for (const [id, entry] of nodes) {
      const next = wanted.find((s) => s.id === id);
      if (!next || next.stream!.id !== entry.streamId) {
        teardown(entry);
        nodes.delete(id);
      }
    }

    for (const s of wanted) {
      const stream = s.stream!;
      const existing = nodes.get(s.id);
      if (existing && existing.streamId === stream.id) continue;
      if (existing) {
        teardown(existing);
        nodes.delete(s.id);
      }

      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        let gain: GainNode | null = null;
        if (!s.isSelf) {
          gain = ctx.createGain();
          gain.gain.value = 1;
          source.connect(gain);
          gain.connect(ctx.destination);
        }

        nodes.set(s.id, { streamId: stream.id, source, analyser, gain });
      } catch {
        // stream may not be connectable yet
      }
    }

    const buffer = new Uint8Array(256);
    const timer = setInterval(() => {
      let loudestId: string | null = null;
      let loudest = SPEAKING_THRESHOLD;
      for (const [id, { analyser }] of nodes) {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        if (avg > loudest) {
          loudest = avg;
          loudestId = id;
        }
      }
      setActiveId((prev) => loudestId ?? prev);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      for (const entry of nodesRef.current.values()) teardown(entry);
      nodesRef.current.clear();
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return { activeId, resumeAudio };
}
