"use client";

import { Hand, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";

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
  handRaised?: boolean;
  /** Floating reaction emojis currently playing on this tile. */
  reactions?: { key: string; emoji: string }[];
  /** Mobile: fill grid cell, show large centered name when video off. */
  compact?: boolean;
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
  handRaised,
  reactions = [],
  compact,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const showVideo = stream !== null && !videoOff && stream.getVideoTracks().length > 0;
  const mirrored = mirror ?? isSelf;

  useEffect(() => {
    if (videoRef.current && stream && showVideo) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, showVideo]);

  // Remote audio always uses a dedicated element — video-only tiles were silent.
  useEffect(() => {
    if (isSelf || !stream) return;

    const play = () => {
      const el = audioRef.current;
      if (!el) return;
      el.srcObject = stream;
      void el.play().catch(() => {
        // autoplay may need a prior user gesture; join click usually satisfies this
      });
    };

    play();
    stream.addEventListener("addtrack", play);
    return () => stream.removeEventListener("addtrack", play);
  }, [stream, isSelf]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-room-panel ring-2 transition-[box-shadow] ${
        compact ? "h-full min-h-[140px] rounded-lg" : "aspect-video rounded-xl"
      } ${active ? "zc-active-speaker ring-[#23D959]" : "ring-transparent"}`}
    >
      {!isSelf && stream && <audio ref={audioRef} autoPlay playsInline className="sr-only" />}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {compact ? (
            <span className="font-serif text-2xl text-white">{name.split(" ")[0]}</span>
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zoom-blue text-2xl font-semibold text-white">
              {initials(name)}
            </span>
          )}
        </div>
      )}

      {handRaised && (
        <div
          className={`absolute flex items-center justify-center text-black shadow ${
            compact
              ? "left-1/2 top-3 -translate-x-1/2 text-2xl"
              : "right-2 top-2 h-7 w-7 rounded-full bg-yellow-400"
          }`}
        >
          {compact ? "✋" : <Hand size={15} />}
        </div>
      )}

      {/* floating reactions rise from the bottom-center */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        {reactions.map((r) => (
          <span key={r.key} className="zc-reaction absolute text-4xl">
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Active speaker indicator label */}
      {active && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-[#23D959]/90 px-2 py-0.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-[10px] font-semibold text-white">Speaking</span>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {muted && <MicOff size={12} className="text-red-400" />}
        <span>{name}</span>
      </div>
    </div>
  );
}
