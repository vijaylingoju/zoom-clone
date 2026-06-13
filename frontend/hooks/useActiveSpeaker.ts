"use client";

import { useEffect, useRef, useState } from "react";

interface SpeakerSource {
  id: string;
  stream: MediaStream | null;
}

const SPEAKING_THRESHOLD = 18; // 0–255 average; below this is treated as silence
const POLL_MS = 250;

/**
 * Detects the loudest current speaker from a set of streams using the Web Audio
 * API (no server involvement). Returns the id of the active speaker, or null.
 * Muted participants have disabled audio tracks, so they read as silent.
 */
export function useActiveSpeaker(sources: SpeakerSource[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(
    new Map(),
  );

  // stable key of which ids currently have an audio-bearing stream
  const key = sources
    .filter((s) => s.stream && s.stream.getAudioTracks().length > 0)
    .map((s) => s.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = ctxRef.current ?? new AudioCtor();
    ctxRef.current = ctx;
    const analysers = analysersRef.current;

    const wanted = new Set(
      sources.filter((s) => s.stream && s.stream.getAudioTracks().length > 0).map((s) => s.id),
    );

    // tear down analysers for streams that are gone
    for (const [id, node] of analysers) {
      if (!wanted.has(id)) {
        node.source.disconnect();
        analysers.delete(id);
      }
    }
    // build analysers for new streams
    for (const s of sources) {
      if (!s.stream || s.stream.getAudioTracks().length === 0 || analysers.has(s.id)) continue;
      try {
        const source = ctx.createMediaStreamSource(s.stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analysers.set(s.id, { analyser, source });
      } catch {
        // a stream may not be connectable (e.g. no live audio yet); skip
      }
    }

    const buffer = new Uint8Array(256);
    const timer = setInterval(() => {
      let loudestId: string | null = null;
      let loudest = SPEAKING_THRESHOLD;
      for (const [id, { analyser }] of analysers) {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        if (avg > loudest) {
          loudest = avg;
          loudestId = id;
        }
      }
      // keep the previous speaker until someone else is clearly louder
      setActiveId((prev) => loudestId ?? prev);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      analysersRef.current.clear();
    };
  }, []);

  return activeId;
}
