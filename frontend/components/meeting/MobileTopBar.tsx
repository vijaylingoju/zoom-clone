"use client";

import { ChevronDown, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { Meeting } from "@/lib/types";

interface MobileTopBarProps {
  meeting: Meeting;
  onLeave: () => void;
}

export function MobileTopBar({ meeting, onLeave }: MobileTopBarProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <header className="relative z-30 flex shrink-0 items-center justify-between bg-black px-3 py-2.5">
      <button type="button" className="flex items-center gap-0.5 text-white/80">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
          zm
        </span>
        <ChevronDown size={14} />
      </button>

      <button
        type="button"
        onClick={() => setInfoOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-white"
      >
        <ShieldCheck size={16} className="text-green-400" />
        Zoom
        <ChevronDown size={14} className="text-white/60" />
      </button>

      <button
        type="button"
        onClick={onLeave}
        className="rounded-md bg-[#E02828] px-4 py-1.5 text-sm font-medium text-white"
      >
        Leave
      </button>

      {infoOpen && (
        <div className="absolute left-3 right-3 top-full mt-1 rounded-xl border border-white/10 bg-[#111] p-3 text-xs text-white shadow-2xl">
          <p className="font-semibold">{meeting.title}</p>
          <p className="mt-1 text-white/60">Encryption enabled (DTLS-SRTP)</p>
        </div>
      )}
    </header>
  );
}
