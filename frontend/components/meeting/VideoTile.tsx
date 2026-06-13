"use client";

import { Hand, MicOff, Pin, PinOff, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { resumeRemoteAudio } from "@/lib/remoteAudio";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  videoOff?: boolean;
  /** Self-view: silence local playback to avoid echo (and mirror by default). */
  isSelf?: boolean;
  /** Override mirroring (e.g. screen share must not be mirrored). */
  mirror?: boolean;
  /** Green ring when this participant is the active speaker. */
  active?: boolean;
  /** Pinned as the main speaker (speaker view). */
  pinned?: boolean;
  handRaised?: boolean;
  /** Filmstrip / gallery cell — smaller tile with large name when video off. */
  compact?: boolean;
  /** Fill parent instead of locking 16:9 (main stage / gallery cells). */
  fill?: boolean;
  objectFit?: "cover" | "contain";
  /** Show pin / unpin control on this tile. */
  showPinControl?: boolean;
  onPinToggle?: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function VideoTile({
  stream,
  name,
  muted,
  videoOff,
  isSelf,
  mirror,
  active,
  pinned,
  handRaised,
  compact,
  fill,
  objectFit = "cover",
  showPinControl,
  onPinToggle,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const showVideo = stream !== null && !videoOff && stream.getVideoTracks().length > 0;
  const mirrored = mirror ?? isSelf;
  const hasRemoteAudio = !isSelf && stream !== null && stream.getAudioTracks().length > 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream || !showVideo) return;
    el.srcObject = stream;
    if (isSelf) {
      el.muted = true;
    } else {
      el.muted = false;
      el.volume = 1;
      resumeRemoteAudio();
    }
  }, [stream, showVideo, isSelf]);

  // Camera-off remote peers: audio-only via a hidden element.
  useEffect(() => {
    if (isSelf || !stream || showVideo) return;

    const attach = () => {
      const el = audioRef.current;
      if (!el) return;
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) return;
      tracks.forEach((t) => {
        t.enabled = true;
      });
      el.srcObject = new MediaStream(tracks);
      el.volume = 1;
      resumeRemoteAudio();
    };

    attach();
    stream.addEventListener("addtrack", attach);
    return () => stream.removeEventListener("addtrack", attach);
  }, [stream, isSelf, showVideo]);

  const shellClass =
    fill && !compact
      ? "h-full min-h-0 w-full rounded-none"
      : fill
        ? "h-full min-h-0 w-full rounded-xl"
        : compact
          ? "h-full min-h-[88px] w-full rounded-lg"
          : "aspect-video w-full rounded-xl";

  return (
    <div
      className={`relative overflow-hidden transition-[box-shadow] ${shellClass} ${
        fill && !compact ? "bg-transparent ring-0" : "bg-room-panel ring-2"
      } ${pinned ? "ring-[#4B9CFF]" : active ? "zc-active-speaker ring-[#23D959]" : fill && !compact ? "" : "ring-transparent"}`}
    >
      {hasRemoteAudio && !showVideo && (
        <audio ref={audioRef} data-remote-audio autoPlay playsInline className="hidden" />
      )}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          data-remote-video={isSelf ? undefined : ""}
          className={`h-full w-full ${objectFit === "contain" ? "object-contain" : "object-cover"} ${mirrored ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#2d2d2d]">
          {compact ? (
            <span className="font-serif text-2xl text-white">{name.split(" ")[0]}</span>
          ) : fill ? (
            <span className="flex h-[min(42vw,260px)] w-[min(42vw,260px)] items-center justify-center rounded-[4px] bg-[#8475CE] text-[min(20vw,128px)] font-normal leading-none text-white">
              {name.trim().charAt(0).toUpperCase()}
            </span>
          ) : (
            <span className="flex h-[88px] w-[88px] items-center justify-center rounded-[4px] bg-[#8475CE] text-4xl font-normal text-white">
              {name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {handRaised && (
        <div
          className={`absolute flex items-center justify-center text-black shadow ${
            compact
              ? "left-1/2 top-3 -translate-x-1/2 text-2xl"
              : "left-2 top-10 h-7 w-7 rounded-full bg-yellow-400"
          }`}
        >
          {compact ? "✋" : <Hand size={15} />}
        </div>
      )}

      {pinned && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-[#4B9CFF]/90 px-2 py-0.5">
          <Pin size={10} className="text-white" />
          <span className="text-[10px] font-semibold text-white">Pinned</span>
        </div>
      )}

      {active && !pinned && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-[#23D959]/90 px-2 py-0.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-[10px] font-semibold text-white">Speaking</span>
        </div>
      )}

      {showPinControl && onPinToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPinToggle();
          }}
          className={`absolute right-2 top-2 z-10 flex items-center justify-center rounded-full text-white shadow ${
            compact ? "h-6 w-6" : "h-7 w-7"
          } ${pinned ? "bg-[#4B9CFF] hover:bg-[#3a8ae8]" : "bg-black/60 hover:bg-black/80"}`}
          aria-label={pinned ? "Unpin participant" : "Pin participant"}
          title={pinned ? "Unpin" : "Pin"}
        >
          {pinned ? <PinOff size={compact ? 12 : 14} /> : <Pin size={compact ? 12 : 14} />}
        </button>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs text-white">
        {muted && <MicOff size={12} className="text-red-400" />}
        {videoOff && <VideoOff size={12} className="text-red-400" />}
        <span>{name.replace(/\s*\(You[^)]*\)/i, "").trim()}</span>
      </div>
    </div>
  );
}
