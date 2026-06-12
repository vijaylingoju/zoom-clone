"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import { ChatPanel } from "@/components/meeting/ChatPanel";
import { RosterPanel } from "@/components/meeting/RosterPanel";
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
  const { peers, chatMessages, sendMediaState, sendChat, setVideoOverride } =
    useMeetingConnection(meeting.meeting_code, participant, media.stream);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const tileCount = peers.length + 1;
  const panelOpen = rosterOpen || chatOpen;

  function toggleAudio() {
    media.toggleAudio();
    sendMediaState(!media.audioEnabled, media.videoEnabled);
  }

  function toggleVideo() {
    media.toggleVideo();
    sendMediaState(media.audioEnabled, !media.videoEnabled);
  }

  function stopShare() {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    void setVideoOverride(null);
    sendMediaState(media.audioEnabled, media.videoEnabled);
  }

  async function toggleShare() {
    if (screenStreamRef.current) {
      stopShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      track.onended = stopShare; // browser's own "Stop sharing" bar
      screenStreamRef.current = display;
      setScreenStream(display);
      await setVideoOverride(track);
      // peers render us by media-state: ensure they show the screen even if
      // our camera was off
      sendMediaState(media.audioEnabled, true);
    } catch {
      // user cancelled the picker — nothing to do
    }
  }

  // stop screen capture if we unmount mid-share (leave/end)
  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function copyInviteFromHeader() {
    await navigator.clipboard.writeText(meeting.join_url);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  const rosterEntries = [
    {
      id: participant.id,
      name: participant.display_name,
      role: participant.role,
      audioEnabled: media.audioEnabled,
      videoEnabled: media.videoEnabled,
      isSelf: true,
    },
    ...peers.map((peer) => ({
      id: peer.id,
      name: peer.name,
      role: peer.role,
      audioEnabled: peer.audioEnabled,
      videoEnabled: peer.videoEnabled,
    })),
  ];

  return (
    <div className="flex h-screen flex-col bg-room-bg">
      <header className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-2 text-sm text-white/70">
        <span className="font-medium text-white">{meeting.title}</span>
        <span className="hidden text-white/40 sm:inline">·</span>
        <span className="flex items-center gap-1.5">
          ID: {meeting.meeting_code}
          <button
            type="button"
            onClick={copyInviteFromHeader}
            aria-label="Copy invite link"
            title="Copy invite link"
            className="rounded p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            {codeCopied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
        </span>
        <span className="hidden text-white/40 sm:inline">·</span>
        <span>
          {tileCount} participant{tileCount > 1 ? "s" : ""}
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <div className={`grid w-full max-w-5xl gap-3 ${gridColumns(tileCount)}`}>
            <VideoTile
              stream={screenStream ?? media.stream}
              name={`${participant.display_name} (You${screenStream ? ", sharing" : ""})`}
              muted={!media.audioEnabled}
              videoOff={screenStream ? false : !media.videoEnabled}
              isSelf
              mirror={screenStream ? false : undefined}
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

        {panelOpen && (
          <aside className="absolute inset-y-0 right-0 z-10 flex w-72 flex-col border-l border-white/10 bg-[#1f1f1f] sm:static sm:w-80">
            {rosterOpen && (
              <RosterPanel
                entries={rosterEntries}
                inviteUrl={meeting.join_url}
                onClose={() => setRosterOpen(false)}
              />
            )}
            {chatOpen && (
              <ChatPanel
                messages={chatMessages}
                selfParticipantId={participant.id}
                onSend={sendChat}
                onClose={() => setChatOpen(false)}
              />
            )}
          </aside>
        )}
      </div>

      <ControlBar
        audioEnabled={media.audioEnabled}
        videoEnabled={media.videoEnabled}
        mediaAvailable={media.permission === "granted"}
        participantCount={tileCount}
        sharing={screenStream !== null}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleRoster={() => setRosterOpen((open) => !open)}
        onToggleChat={() => setChatOpen((open) => !open)}
        onToggleShare={() => void toggleShare()}
        onLeave={onLeave}
      />
    </div>
  );
}
