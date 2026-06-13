"use client";

import {
  ChevronUp,
  Mic,
  MicOff,
  MessageSquare,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Shield,
  SmilePlus,
  Sparkles,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DeviceMenu } from "@/components/meeting/DeviceMenu";
import { MobileMoreSheet } from "@/components/meeting/MobileMoreSheet";
import { MoreMenu } from "@/components/meeting/MoreMenu";
import { ReactionTray } from "@/components/meeting/ReactionTray";
import { useIsMobile } from "@/hooks/useIsMobile";

type MenuId = "audio" | "video" | "react" | "more" | "end" | "mobile-more" | null;

interface ControlButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

function ControlButton({
  label,
  active,
  onClick,
  onIcon,
  offIcon,
  disabled,
  className = "",
}: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-lg py-2 text-white transition hover:bg-white/10 disabled:opacity-40 ${className}`}
    >
      <span className={active ? "" : "text-red-400"}>{active ? onIcon : offIcon}</span>
      <span className="text-[10px] sm:text-[11px]">{label}</span>
    </button>
  );
}

function Chevron({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More options"
      className="absolute -right-0.5 top-0.5 z-10 rounded p-0.5 text-white/70 hover:bg-white/10"
    >
      <ChevronUp size={12} />
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
  handRaised: boolean;
  incomingVideoStopped: boolean;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  currentAudioId: string | null;
  currentVideoId: string | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onPickAudio: (deviceId: string) => void;
  onPickVideo: (deviceId: string) => void;
  onToggleRoster: () => void;
  onToggleChat: () => void;
  /** Mobile: open panel without toggling closed. */
  onOpenChat?: () => void;
  onOpenParticipants?: () => void;
  onToggleShare: () => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onToggleIncomingVideo: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
  onMenuOpenChange?: (open: boolean) => void;
  unreadMessages?: number;
}

export function ControlBar(props: ControlBarProps) {
  const {
    audioEnabled,
    videoEnabled,
    mediaAvailable,
    participantCount,
    sharing,
    isHost,
    handRaised,
    incomingVideoStopped,
    audioDevices,
    videoDevices,
    currentAudioId,
    currentVideoId,
    onToggleAudio,
    onToggleVideo,
    onPickAudio,
    onPickVideo,
    onToggleRoster,
    onToggleChat,
    onOpenChat,
    onOpenParticipants,
    onToggleShare,
    onReact,
    onToggleHand,
    onToggleIncomingVideo,
    onLeave,
    onEndForAll,
    onMenuOpenChange,
    unreadMessages = 0,
  } = props;

  const isMobile = useIsMobile();
  const [menu, setMenu] = useState<MenuId>(null);
  const [portalReady, setPortalReady] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const openMenu = (id: MenuId) => setMenu((cur) => (cur === id ? null : id));

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    onMenuOpenChange?.(menu !== null);
  }, [menu, onMenuOpenChange]);

  // Desktop only: close popovers on outside click.
  // Mobile More sheet is portaled outside barRef — mousedown here was
  // unmounting the sheet before its button onClick could run.
  useEffect(() => {
    if (isMobile) return;

    function handler(event: MouseEvent) {
      if (!barRef.current) return;
      const target = event.target as Node;
      if (barRef.current.contains(target)) return;
      if (sheetRef.current?.contains(target)) return;
      setMenu(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  if (isMobile) {
    return (
      <>
        <div ref={barRef} className="relative z-40 flex items-center justify-around bg-black px-6 py-3">
          <ControlButton
            label={audioEnabled ? "Mute" : "Unmute"}
            active={audioEnabled}
            onClick={onToggleAudio}
            onIcon={<Mic size={22} />}
            offIcon={<MicOff size={22} />}
            disabled={!mediaAvailable}
            className="w-20"
          />
          <ControlButton
            label="Video"
            active={videoEnabled}
            onClick={onToggleVideo}
            onIcon={<Video size={22} />}
            offIcon={<VideoOff size={22} />}
            disabled={!mediaAvailable}
            className="w-20"
          />
          <div className="relative">
            <ControlButton
              label="More"
              active
              onClick={() => openMenu("mobile-more")}
              onIcon={<MoreHorizontal size={22} className="rounded-full border border-white/40 p-1" />}
              offIcon={<MoreHorizontal size={22} className="rounded-full border border-white/40 p-1" />}
              className="w-20"
            />
            {unreadMessages > 0 && (
              <span className="pointer-events-none absolute right-2 top-0 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </div>
        </div>

        {menu === "mobile-more" &&
          portalReady &&
          createPortal(
            <div ref={sheetRef}>
              <MobileMoreSheet
                handRaised={handRaised}
                sharing={sharing}
                unreadMessages={unreadMessages}
                onToggleHand={onToggleHand}
                onOpenParticipants={onOpenParticipants ?? onToggleRoster}
                onOpenChat={onOpenChat ?? onToggleChat}
                onToggleShare={onToggleShare}
                onClose={() => setMenu(null)}
              />
            </div>,
            document.body,
          )}
      </>
    );
  }

  return (
    <div ref={barRef} className="relative z-40 flex items-center justify-between bg-room-bg px-4 py-2">
      {/* Left: Mic + Video */}
      <div className="flex shrink-0 items-center gap-1 overflow-visible">
        <div className="relative overflow-visible">
          <ControlButton
            label={audioEnabled ? "Mute" : "Unmute"}
            active={audioEnabled}
            onClick={onToggleAudio}
            onIcon={<Mic size={20} />}
            offIcon={<MicOff size={20} />}
            disabled={!mediaAvailable}
            className="w-16"
          />
          {mediaAvailable && (
            <Chevron onClick={(e) => { e.stopPropagation(); openMenu("audio"); }} />
          )}
          {menu === "audio" && (
            <DeviceMenu
              title="Select a Microphone"
              devices={audioDevices}
              currentId={currentAudioId}
              onSelect={onPickAudio}
              onClose={() => setMenu(null)}
            />
          )}
        </div>

        <div className="relative overflow-visible">
          <ControlButton
            label={videoEnabled ? "Stop Video" : "Start Video"}
            active={videoEnabled}
            onClick={onToggleVideo}
            onIcon={<Video size={20} />}
            offIcon={<VideoOff size={20} />}
            disabled={!mediaAvailable}
            className="w-16"
          />
          {mediaAvailable && (
            <Chevron onClick={(e) => { e.stopPropagation(); openMenu("video"); }} />
          )}
          {menu === "video" && (
            <DeviceMenu
              title="Select a Camera"
              devices={videoDevices}
              currentId={currentVideoId}
              onSelect={onPickVideo}
              onClose={() => setMenu(null)}
            />
          )}
        </div>
      </div>

      {/* Center: Participants … More — absolutely centered */}
      <div className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 overflow-visible">
        <div className="pointer-events-auto relative overflow-visible">
          <ControlButton
            label="Participants"
            active
            onClick={onToggleRoster}
            onIcon={<Users size={20} />}
            offIcon={<Users size={20} />}
            className="w-16"
          />
          <span className="pointer-events-none absolute -top-0.5 right-1 rounded-full bg-zoom-blue px-1.5 text-[10px] font-semibold text-white">
            {participantCount}
          </span>
          <Chevron onClick={(e) => { e.stopPropagation(); onToggleRoster(); }} />
        </div>

        <div className="relative overflow-visible">
          <ControlButton
            label="Chat"
            active
            onClick={onToggleChat}
            onIcon={<MessageSquare size={20} />}
            offIcon={<MessageSquare size={20} />}
            className="w-16"
          />
          {unreadMessages > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          )}
        </div>
        <div className="relative overflow-visible">
          <ControlButton
            label="React"
            active
            onClick={() => openMenu("react")}
            onIcon={<SmilePlus size={20} />}
            offIcon={<SmilePlus size={20} />}
            className="w-16"
          />
          {menu === "react" && (
            <ReactionTray
              handRaised={handRaised}
              onReact={onReact}
              onToggleHand={onToggleHand}
              onClose={() => setMenu(null)}
            />
          )}
        </div>

        <div className="relative overflow-visible">
          <button
            type="button"
            onClick={onToggleShare}
            className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2 transition hover:bg-white/10 ${
              sharing ? "text-red-400" : "text-[#23D959]"
            }`}
          >
            <MonitorUp size={20} />
            <span className="text-[10px] sm:text-[11px]">{sharing ? "Stop Share" : "Share"}</span>
          </button>
          <Chevron onClick={(e) => { e.stopPropagation(); onToggleShare(); }} />
        </div>

        <button
          type="button"
          title="Not available in this demo"
          className="flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-white/50 transition hover:bg-white/10"
        >
          <Shield size={20} />
          <span className="text-[10px] sm:text-[11px]">Host tools</span>
        </button>

        <button
          type="button"
          title="Not available in this demo"
          className="flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-white/50 transition hover:bg-white/10"
        >
          <Sparkles size={20} />
          <span className="text-[10px] sm:text-[11px]">AI Companion</span>
        </button>

        <div className="relative overflow-visible">
          <ControlButton
            label="More"
            active
            onClick={() => openMenu("more")}
            onIcon={<MoreHorizontal size={20} />}
            offIcon={<MoreHorizontal size={20} />}
            className="w-16"
          />
          {menu === "more" && (
            <MoreMenu
              incomingVideoStopped={incomingVideoStopped}
              onToggleIncomingVideo={onToggleIncomingVideo}
              onClose={() => setMenu(null)}
            />
          )}
        </div>
      </div>

      {/* Right: End */}
      <div className="relative shrink-0 overflow-visible">
        {isHost ? (
          <>
            <button
              type="button"
              onClick={() => openMenu("end")}
              className="flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-white transition hover:bg-white/10"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E02828]">
                <X size={14} className="text-white" />
              </span>
              <span className="text-[10px] sm:text-[11px]">End</span>
            </button>
            {menu === "end" && (
              <div className="absolute bottom-16 right-0 z-50 w-56 rounded-xl border border-white/10 bg-[#111] p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => { onEndForAll(); setMenu(null); }}
                  className="block w-full rounded-lg bg-[#E02828] px-3 py-2 text-center text-sm font-medium text-white hover:bg-[#c52222]"
                >
                  End Meeting for All
                </button>
                <button
                  type="button"
                  onClick={() => { onLeave(); setMenu(null); }}
                  className="mt-1.5 block w-full rounded-lg border border-white/15 px-3 py-2 text-center text-sm text-white hover:bg-white/10"
                >
                  Leave Meeting
                </button>
                <button
                  type="button"
                  onClick={() => setMenu(null)}
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
            className="flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-white transition hover:bg-white/10"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E02828]">
              <PhoneOff size={12} className="text-white" />
            </span>
            <span className="text-[10px] sm:text-[11px]">Leave</span>
          </button>
        )}
      </div>
    </div>
  );
}
