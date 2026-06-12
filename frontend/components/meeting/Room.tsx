"use client";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import { useMeetingConnection } from "@/hooks/useMeetingConnection";
import type { LocalMedia } from "@/hooks/useLocalMedia";
import type { Meeting, Participant } from "@/lib/types";

interface RoomProps {
  meeting: Meeting;
  participant: Participant;
  media: LocalMedia;
  onLeave: () => void;
}

function gridColumns(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-3";
}

export function Room({ meeting, participant, media, onLeave }: RoomProps) {
  const { peers, sendMediaState } = useMeetingConnection(
    meeting.meeting_code,
    participant,
    media.stream,
  );
  const tileCount = peers.length + 1;

  function toggleAudio() {
    media.toggleAudio();
    sendMediaState(!media.audioEnabled, media.videoEnabled);
  }

  function toggleVideo() {
    media.toggleVideo();
    sendMediaState(media.audioEnabled, !media.videoEnabled);
  }

  return (
    <div className="flex h-screen flex-col bg-room-bg">
      <header className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-white/70">
        <span className="font-medium text-white">{meeting.title}</span>
        <span className="text-white/40">·</span>
        <span>ID: {meeting.meeting_code}</span>
        <span className="text-white/40">·</span>
        <span>
          {tileCount} participant{tileCount > 1 ? "s" : ""}
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
        <div className={`grid w-full max-w-5xl gap-3 ${gridColumns(tileCount)}`}>
          <VideoTile
            stream={media.stream}
            name={`${participant.display_name} (You)`}
            muted={!media.audioEnabled}
            videoOff={!media.videoEnabled}
            isSelf
          />
          {peers.map((peer) => (
            <VideoTile
              key={peer.id}
              stream={peer.stream}
              name={peer.name}
              muted={!peer.audioEnabled}
              videoOff={!peer.videoEnabled}
            />
          ))}
        </div>
      </main>

      <ControlBar
        audioEnabled={media.audioEnabled}
        videoEnabled={media.videoEnabled}
        mediaAvailable={media.permission === "granted"}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onLeave={onLeave}
      />
    </div>
  );
}
