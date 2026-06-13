"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { resumeRemoteAudio } from "@/lib/remoteAudio";

export interface SpeakerSource {
  id: string;
  stream: MediaStream | null;
  isSelf?: boolean;
}

const SPEAKING_THRESHOLD = 0.01;
const POLL_MS = 300;

/**
 * Active-speaker highlight via inbound RTP stats — does not tap MediaStreams,
 * so HTML audio elements can play remote audio without being hijacked.
 */
export function useActiveSpeaker(
  sources: SpeakerSource[],
  pollLevels?: () => Promise<Map<string, number>>,
): {
  activeId: string | null;
  resumeAudio: () => void;
} {
  const [activeId, setActiveId] = useState<string | null>(null);
  const pollRef = useRef(pollLevels);
  pollRef.current = pollLevels;

  const resumeAudio = useCallback(() => {
    resumeRemoteAudio();
  }, []);

  const selfIds = sources.filter((s) => s.isSelf).map((s) => s.id).join(",");

  useEffect(() => {
    const timer = setInterval(() => {
      void (async () => {
        const levels = pollRef.current ? await pollRef.current() : new Map<string, number>();
        let loudestId: string | null = null;
        let loudest = SPEAKING_THRESHOLD;
        for (const [id, level] of levels) {
          if (level > loudest) {
            loudest = level;
            loudestId = id;
          }
        }
        setActiveId((prev) => loudestId ?? prev);
      })();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [selfIds, sources.length]);

  return { activeId, resumeAudio };
}
