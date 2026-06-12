"use client";

import { Mic, MicOff, Phone, Video, VideoOff } from "lucide-react";

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
      className="flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-white transition hover:bg-white/10 disabled:opacity-40"
    >
      <span className={active ? "" : "text-red-400"}>{active ? onIcon : offIcon}</span>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  mediaAvailable: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
}

export function ControlBar({
  audioEnabled,
  videoEnabled,
  mediaAvailable,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-between bg-room-bg px-4 py-2">
      <div className="flex items-center gap-2">
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
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="flex items-center gap-2 rounded-lg bg-[#E02828] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#c52222]"
      >
        <Phone size={16} className="rotate-[135deg]" />
        Leave
      </button>
    </div>
  );
}
