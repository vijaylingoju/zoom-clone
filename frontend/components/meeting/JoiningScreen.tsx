"use client";

import { ChevronLeft } from "lucide-react";

interface JoiningScreenProps {
  message?: string;
  onBack?: () => void;
}

/** Zoom-style pre-join loading screen (dark bg, spinner, Back link). */
export function JoiningScreen({
  message = "Joining Meeting...",
  onBack,
}: JoiningScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#1a1a1a]">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-5 top-5 z-10 flex items-center gap-0.5 text-[15px] font-medium text-[#0e71eb] transition hover:underline"
        >
          <ChevronLeft size={20} strokeWidth={2} />
          Back
        </button>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div
          className="h-[52px] w-[52px] animate-spin rounded-full border-4 border-white/20 border-t-[#0e71eb]"
          aria-hidden
        />
        <p className="mt-7 text-center text-[22px] font-normal leading-snug tracking-[-0.01em] text-white">
          {message}
        </p>
      </div>
    </div>
  );
}
