"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useEffect, useState } from "react";

import { VideoTile } from "@/components/meeting/VideoTile";
import type { LocalMedia } from "@/hooks/useLocalMedia";
import type { Meeting } from "@/lib/types";

interface LobbyProps {
  meeting: Meeting;
  media: LocalMedia;
  defaultName: string;
  joining: boolean;
  joinError: string | null;
  onJoin: (displayName: string) => void;
}

function RoundToggle({
  active,
  onClick,
  onIcon,
  offIcon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition disabled:opacity-40 ${
        active ? "bg-white/15 hover:bg-white/25" : "bg-[#E02828] hover:bg-[#c52222]"
      }`}
    >
      {active ? onIcon : offIcon}
    </button>
  );
}

export function Lobby({ meeting, media, defaultName, joining, joinError, onJoin }: LobbyProps) {
  const [name, setName] = useState(defaultName);
  const [nameTouched, setNameTouched] = useState(false);
  const mediaAvailable = media.permission === "granted";

  // defaultName arrives async (/api/me); prefill until the user edits the field
  useEffect(() => {
    if (!nameTouched) setName(defaultName);
  }, [defaultName, nameTouched]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-room-bg px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="mb-1 text-center text-xl font-semibold text-white">{meeting.title}</h1>
        <p className="mb-6 text-center text-sm text-white/50">
          Meeting ID: {meeting.meeting_code}
        </p>

        <VideoTile
          stream={media.stream}
          name={name.trim() || "You"}
          muted={!media.audioEnabled}
          videoOff={!media.videoEnabled}
          isSelf
        />

        {media.permission === "denied" && (
          <p className="mt-3 text-center text-sm text-amber-400">
            Camera and microphone are blocked. Allow access in your browser, or join without
            them.
          </p>
        )}
        {media.permission === "unavailable" && (
          <p className="mt-3 text-center text-sm text-white/60">
            No camera or microphone found — you can still join and watch.
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-4">
          <RoundToggle
            active={media.audioEnabled}
            onClick={media.toggleAudio}
            onIcon={<Mic size={20} />}
            offIcon={<MicOff size={20} />}
            label={media.audioEnabled ? "Mute microphone" : "Unmute microphone"}
            disabled={!mediaAvailable}
          />
          <RoundToggle
            active={media.videoEnabled}
            onClick={() => void media.toggleVideo()}
            onIcon={<Video size={20} />}
            offIcon={<VideoOff size={20} />}
            label={media.videoEnabled ? "Stop video" : "Start video"}
            disabled={!mediaAvailable}
          />
        </div>

        <form
          className="mx-auto mt-6 flex max-w-sm flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin(name.trim());
          }}
        >
          <input
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder="Your name"
            maxLength={50}
            required
            aria-label="Your name"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/30"
          />
          {joinError && <p className="text-center text-sm text-red-400">{joinError}</p>}
          <button
            type="submit"
            disabled={joining || !name.trim()}
            className="w-full rounded-lg bg-zoom-blue py-2.5 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
