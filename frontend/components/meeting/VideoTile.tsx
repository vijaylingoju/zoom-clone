"use client";

import { MicOff } from "lucide-react";
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
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function VideoTile({ stream, name, muted, videoOff, isSelf, mirror }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const showVideo = stream !== null && !videoOff && stream.getVideoTracks().length > 0;
  const mirrored = mirror ?? isSelf;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, showVideo]);

  // Remote audio must keep playing even when the tile shows the avatar —
  // without a media element attached, the audio track is silent.
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, showVideo]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-room-panel">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {!isSelf && stream && <audio ref={audioRef} autoPlay />}
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zoom-blue text-2xl font-semibold text-white">
            {initials(name)}
          </span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {muted && <MicOff size={12} className="text-red-400" />}
        <span>{name}</span>
      </div>
    </div>
  );
}
