"use client";

import { Check, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ViewMode = "speaker" | "gallery";

interface ViewMenuProps {
  mode: ViewMode;
  hideSelf: boolean;
  onMode: (mode: ViewMode) => void;
  onToggleHideSelf: () => void;
  variant?: "default" | "header";
}

export function ViewMenu({
  mode,
  hideSelf,
  onMode,
  onToggleHideSelf,
  variant = "default",
}: ViewMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
    setOpen(false);
  }

  const row = "flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:bg-white/10";
  const isHeader = variant === "header";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          isHeader
            ? "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            : "flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70"
        }
      >
        <LayoutGrid size={isHeader ? 13 : 15} />
        View
      </button>
      {open && (
        <div
          className={`absolute right-0 z-30 w-56 rounded-xl border border-white/10 bg-[#1f1f1f] p-1.5 shadow-2xl ${
            isHeader ? "top-8" : "top-10"
          }`}
        >
          <button type="button" className={row} onClick={() => { onMode("speaker"); setOpen(false); }}>
            Speaker View {mode === "speaker" && <Check size={15} />}
          </button>
          <button type="button" className={row} onClick={() => { onMode("gallery"); setOpen(false); }}>
            Gallery View {mode === "gallery" && <Check size={15} />}
          </button>
          <div className="my-1 border-t border-white/10" />
          <button type="button" className={row} onClick={() => { onToggleHideSelf(); setOpen(false); }}>
            Hide Self View {hideSelf && <Check size={15} />}
          </button>
          <button type="button" className={row} onClick={toggleFullscreen}>
            Fullscreen
          </button>
        </div>
      )}
    </div>
  );
}
