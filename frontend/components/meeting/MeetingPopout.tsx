"use client";

import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Mic,
  MicOff,
  PictureInPicture2,
  SlidersHorizontal,
  TriangleAlert,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";

import { useFloatingWindow } from "@/hooks/useFloatingWindow";
import type { MeetingPopoutControls } from "@/lib/meetingPipContext";

const HEADER_H = 28;
const FOOTER_H = 40;

interface MeetingPopoutProps {
  displayName: string;
  mediaAvailable: boolean;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  controlsRef: MutableRefObject<MeetingPopoutControls | null>;
  onExpand: () => void;
  onClose: () => void;
}

function PopoutVideo({
  stream,
  displayName,
  videoEnabled,
}: {
  stream: MediaStream | null;
  displayName: string;
  videoEnabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo =
    stream !== null && videoEnabled && stream.getVideoTracks().some((t) => t.enabled);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream || !showVideo) return;
    el.srcObject = stream;
    el.muted = true;
  }, [stream, showVideo]);

  if (showVideo) {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full -scale-x-100 object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <span className="flex h-[88px] w-[88px] items-center justify-center rounded-[4px] bg-[#0d9488] text-[42px] font-normal leading-none text-white">
        {displayName.trim().charAt(0).toUpperCase() || "?"}
      </span>
    </div>
  );
}

export function MeetingPopout({
  displayName,
  mediaAvailable,
  stream,
  audioEnabled,
  videoEnabled,
  controlsRef,
  onExpand,
  onClose,
}: MeetingPopoutProps) {
  const [mounted, setMounted] = useState(false);
  const [footerExpanded, setFooterExpanded] = useState(true);

  const {
    rect,
    onDragPointerDown,
    onDragPointerMove,
    onDragPointerUp,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
  } = useFloatingWindow();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hasVideoTrack = (stream?.getVideoTracks().length ?? 0) > 0;
  const showCameraWarning = mediaAvailable && !hasVideoTrack;
  const stageHeight = rect.height - HEADER_H - FOOTER_H;

  function handleToggleAudio(event: React.MouseEvent) {
    event.stopPropagation();
    controlsRef.current?.toggleAudio();
  }

  function handleToggleVideo(event: React.MouseEvent) {
    event.stopPropagation();
    void controlsRef.current?.toggleVideo();
  }

  return createPortal(
    <div
      className="fixed z-[9999] select-none overflow-hidden rounded-[10px] border border-[#4a4a4a] bg-[#2b2b2b] shadow-[0_14px_44px_rgba(0,0,0,0.55)]"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      {/* Header — drag from title area only */}
      <div className="flex h-7 items-center justify-between bg-[#3a3a3a] px-2">
        <div
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 active:cursor-grabbing"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
        >
          <SlidersHorizontal size={13} className="shrink-0 text-white/85" strokeWidth={2} />
          <span className="truncate text-[11px] font-medium text-white/95">app.zoom.clone</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleToggleAudio}
            className="rounded p-1 text-white/85 hover:bg-white/10"
            aria-label={audioEnabled ? "Mute" : "Unmute"}
          >
            {audioEnabled ? <Mic size={13} /> : <MicOff size={13} className="text-[#ff5c5c]" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="rounded p-1 text-white/85 hover:bg-white/10"
            aria-label="Expand meeting"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded p-1 text-white/85 hover:bg-white/10"
            aria-label="Close meeting"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="bg-black" style={{ height: stageHeight }}>
        <PopoutVideo stream={stream} displayName={displayName} videoEnabled={videoEnabled} />
      </div>

      {/* Footer */}
      <div className="relative flex h-10 items-center bg-[#3a3a3a] px-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFooterExpanded((v) => !v);
          }}
          className="rounded p-1 text-white/70 hover:bg-white/10"
          aria-label={footerExpanded ? "Collapse controls" : "Expand controls"}
        >
          {footerExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>

        {footerExpanded ? (
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4">
            <button
              type="button"
              onClick={handleToggleAudio}
              disabled={!mediaAvailable}
              className="text-white disabled:opacity-40"
              aria-label={audioEnabled ? "Mute" : "Unmute"}
            >
              {audioEnabled ? (
                <Mic size={18} strokeWidth={1.75} />
              ) : (
                <MicOff size={18} className="text-[#ff5c5c]" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={handleToggleVideo}
              disabled={!mediaAvailable}
              className="flex items-center gap-1 text-white disabled:opacity-40"
              aria-label={videoEnabled ? "Stop video" : "Start video"}
            >
              {videoEnabled ? (
                <Video size={18} strokeWidth={1.75} />
              ) : (
                <VideoOff size={18} className="text-[#ff5c5c]" strokeWidth={1.75} />
              )}
              {showCameraWarning && (
                <TriangleAlert size={11} className="text-[#ff5c5c]" fill="#ff5c5c" strokeWidth={0} />
              )}
            </button>
          </div>
        ) : (
          <p className="absolute left-1/2 max-w-[58%] -translate-x-1/2 truncate text-center text-[12px] text-white/90">
            {displayName}
          </p>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="ml-auto rounded p-1 text-white/85 hover:bg-white/10"
          aria-label="Return to meeting"
        >
          <PictureInPicture2 size={15} />
        </button>
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        aria-hidden
      />
    </div>,
    document.body,
  );
}
