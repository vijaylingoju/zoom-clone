"use client";

import { Hand } from "lucide-react";
import { useEffect, useRef } from "react";

const EMOJIS = ["👏", "👍", "😂", "😮", "❤️", "🎉"];

interface ReactionTrayProps {
  handRaised: boolean;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onClose: () => void;
}

export function ReactionTray({ handRaised, onReact, onToggleHand, onClose }: ReactionTrayProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-16 left-1/2 z-50 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1f1f1f] p-2 shadow-2xl"
    >
      <div className="flex justify-between px-1 pb-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className="rounded-lg p-1.5 text-2xl transition hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          onToggleHand();
          onClose();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-sm text-white transition hover:bg-white/10"
      >
        <Hand size={16} className={handRaised ? "text-yellow-400" : ""} />
        {handRaised ? "Lower Hand" : "Raise Hand"}
      </button>
    </div>
  );
}
