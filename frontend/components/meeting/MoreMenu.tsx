"use client";

import { Captions, PencilRuler, Settings, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";

interface MoreMenuProps {
  incomingVideoStopped: boolean;
  onToggleIncomingVideo: () => void;
  onClose: () => void;
}

export function MoreMenu({ incomingVideoStopped, onToggleIncomingVideo, onClose }: MoreMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:bg-white/10";
  const stub = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/40";

  return (
    <div
      ref={ref}
      className="absolute bottom-16 right-0 z-50 w-56 rounded-xl border border-white/10 bg-[#1f1f1f] p-1.5 shadow-2xl"
    >
      <button type="button" className={stub} title="Not available in this demo">
        <Captions size={16} /> Captions
      </button>
      <button type="button" className={stub} title="Not available in this demo">
        <PencilRuler size={16} /> Whiteboards
      </button>
      <div className="my-1 border-t border-white/10" />
      <button type="button" className={row} onClick={() => { onToggleIncomingVideo(); onClose(); }}>
        <VideoOff size={16} />
        {incomingVideoStopped ? "Start Incoming Video" : "Stop Incoming Video"}
      </button>
      <button type="button" className={stub} title="Use the ⌃ menus by Mute/Video to pick devices">
        <Settings size={16} /> Settings
      </button>
    </div>
  );
}
