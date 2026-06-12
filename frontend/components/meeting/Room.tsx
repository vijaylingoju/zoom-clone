"use client";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import type { LocalMedia } from "@/hooks/useLocalMedia";
import type { Meeting, Participant } from "@/lib/types";

interface RoomProps {
  meeting: Meeting;
  participant: Participant;
  media: LocalMedia;
  onLeave: () => void;
}

/**
 * Meeting room. Currently renders the local participant only; Step 5 connects
 * signaling + mesh WebRTC and this grid grows with remote tiles.
 */
export function Room({ meeting, participant, media, onLeave }: RoomProps) {
  return (
    <div className="flex min-h-screen flex-col bg-room-bg">
      <header className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-white/70">
        <span className="font-medium text-white">{meeting.title}</span>
        <span className="text-white/40">·</span>
        <span>ID: {meeting.meeting_code}</span>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="grid w-full max-w-3xl grid-cols-1 gap-3">
          <VideoTile
            stream={media.stream}
            name={`${participant.display_name} (You)`}
            muted={!media.audioEnabled}
            videoOff={!media.videoEnabled}
            isSelf
          />
        </div>
      </main>

      <ControlBar
        audioEnabled={media.audioEnabled}
        videoEnabled={media.videoEnabled}
        mediaAvailable={media.permission === "granted"}
        onToggleAudio={media.toggleAudio}
        onToggleVideo={media.toggleVideo}
        onLeave={onLeave}
      />
    </div>
  );
}
