"use client";

import type { FloatingReaction } from "@/hooks/useMeetingConnection";

interface MeetingReactionsProps {
  reactions: FloatingReaction[];
}

/** Full-stage floating emoji reactions (not clipped to a single video tile). */
export function MeetingReactions({ reactions }: MeetingReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {reactions.map((reaction) => (
        <span
          key={reaction.key}
          className="zc-reaction absolute bottom-[12%] -translate-x-1/2 text-5xl drop-shadow-lg sm:bottom-[15%] sm:text-6xl"
          style={{ left: `${reaction.leftPct}%` }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
