"use client";

import {
  Mic,
  MicOff,
  MessageSquare,
  MonitorUp,
  Phone,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ControlButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  disabled?: boolean;
}

function ControlButton({ label, active, onClick, onIcon, offIcon, disabled }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-12 flex-col items-center gap-1 rounded-lg py-2 text-white transition hover:bg-white/10 disabled:opacity-40 sm:w-16"
    >
      <span className={active ? "" : "text-red-400"}>{active ? onIcon : offIcon}</span>
      <span className="text-[10px] sm:text-[11px]">{label}</span>
    </button>
  );
}

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  mediaAvailable: boolean;
  participantCount: number;
  sharing: boolean;
  isHost: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleRoster: () => void;
  onToggleChat: () => void;
  onToggleShare: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

export function ControlBar({
  audioEnabled,
  videoEnabled,
  mediaAvailable,
  participantCount,
  sharing,
  isHost,
  onToggleAudio,
  onToggleVideo,
  onToggleRoster,
  onToggleChat,
  onToggleShare,
  onLeave,
  onEndForAll,
}: ControlBarProps) {
  const [endMenuOpen, setEndMenuOpen] = useState(false);
  const endMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (endMenuRef.current && !endMenuRef.current.contains(event.target as Node)) {
        setEndMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex items-center justify-between bg-room-bg px-2 py-2 sm:px-4">
      <div className="flex items-center gap-0.5 sm:gap-2">
        <ControlButton
          label={audioEnabled ? "Mute" : "Unmute"}
          active={audioEnabled}
          onClick={onToggleAudio}
          onIcon={<Mic size={20} />}
          offIcon={<MicOff size={20} />}
          disabled={!mediaAvailable}
        />
        <ControlButton
          label={videoEnabled ? "Stop Video" : "Start Video"}
          active={videoEnabled}
          onClick={onToggleVideo}
          onIcon={<Video size={20} />}
          offIcon={<VideoOff size={20} />}
          disabled={!mediaAvailable}
        />
        <div className="relative">
          <ControlButton
            label="Participants"
            active
            onClick={onToggleRoster}
            onIcon={<Users size={20} />}
            offIcon={<Users size={20} />}
          />
          <span className="pointer-events-none absolute -top-0.5 right-1 rounded-full bg-zoom-blue px-1.5 text-[10px] font-semibold text-white">
            {participantCount}
          </span>
        </div>
        <ControlButton
          label="Chat"
          active
          onClick={onToggleChat}
          onIcon={<MessageSquare size={20} />}
          offIcon={<MessageSquare size={20} />}
        />
        <button
          type="button"
          onClick={onToggleShare}
          className={`flex w-12 flex-col items-center gap-1 rounded-lg py-2 transition hover:bg-white/10 sm:w-16 ${
            sharing ? "text-red-400" : "text-[#23D959]"
          }`}
        >
          <MonitorUp size={20} />
          <span className="text-[10px] sm:text-[11px]">{sharing ? "Stop Share" : "Share"}</span>
        </button>
      </div>

      <div className="relative" ref={endMenuRef}>
        {isHost ? (
          <>
            <button
              type="button"
              onClick={() => setEndMenuOpen((open) => !open)}
              className="ml-1 rounded-lg bg-[#E02828] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c52222] sm:px-6"
            >
              End
            </button>
            {endMenuOpen && (
              <div className="absolute bottom-12 right-0 z-30 w-56 rounded-xl border border-white/10 bg-[#111] p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={onEndForAll}
                  className="block w-full rounded-lg bg-[#E02828] px-3 py-2 text-center text-sm font-medium text-white hover:bg-[#c52222]"
                >
                  End Meeting for All
                </button>
                <button
                  type="button"
                  onClick={onLeave}
                  className="mt-1.5 block w-full rounded-lg border border-white/15 px-3 py-2 text-center text-sm text-white hover:bg-white/10"
                >
                  Leave Meeting
                </button>
                <button
                  type="button"
                  onClick={() => setEndMenuOpen(false)}
                  className="mt-1.5 block w-full rounded-lg px-3 py-2 text-center text-sm text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="ml-1 flex items-center gap-2 rounded-lg bg-[#E02828] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c52222] sm:px-5"
          >
            <Phone size={16} className="rotate-[135deg]" />
            Leave
          </button>
        )}
      </div>
    </div>
  );
}
