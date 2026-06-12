"use client";

import { useEffect, useRef, useState } from "react";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import { ChatPanel } from "@/components/meeting/ChatPanel";
import { MeetingInfoPopover } from "@/components/meeting/MeetingInfoPopover";
import { RosterPanel } from "@/components/meeting/RosterPanel";
import { useMeetingConnection } from "@/hooks/useMeetingConnection";
import type { LocalMedia } from "@/hooks/useLocalMedia";
import type { Meeting, Participant } from "@/lib/types";

interface RoomProps {
  meeting: Meeting;
  participant: Participant;
  media: LocalMedia;
  onLeft: () => void;
  onEnded: () => void;
  onRemoved: () => void;
}

function gridColumns(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-3";
}

const CHROME_HIDE_MS = 3500;

export function Room({ meeting, participant, media, onLeft, onEnded, onRemoved }: RoomProps) {
  const isHost = participant.role === "host";
  const [rosterOpen, setRosterOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    peers,
    chatMessages,
    sendMediaState,
    sendChat,
    setVideoOverride,
    muteAll,
    removeParticipant,
    endMeetingForAll,
  } = useMeetingConnection(meeting.meeting_code, participant, media.stream, {
    onForceMute: () => {
      // honor the host's mute: disable our track and tell everyone
      const tracks = media.stream?.getAudioTracks() ?? [];
      if (tracks.some((track) => track.enabled)) {
        media.toggleAudio();
        sendMediaState(false, media.videoEnabled);
      }
    },
    onRemoved,
    onMeetingEnded: onEnded,
  });

  const tileCount = peers.length + 1;
  const panelOpen = rosterOpen || chatOpen;

  // Zoom-style auto-hiding chrome: reappear on mouse move, fade when idle
  useEffect(() => {
    function poke() {
      setChromeVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
    }
    poke();
    window.addEventListener("mousemove", poke);
    window.addEventListener("keydown", poke);
    return () => {
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("keydown", poke);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

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
      track.onended = stopShare;
      screenStreamRef.current = display;
      setScreenStream(display);
      await setVideoOverride(track);
      sendMediaState(media.audioEnabled, true);
    } catch {
      // user cancelled the picker
    }
  }

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

  const mediaUnavailable = media.permission !== "granted";

  return (
    <div className="flex h-screen flex-col bg-room-bg">
      <div className="relative flex min-h-0 flex-1">
        <main className="relative flex flex-1 items-center justify-center overflow-y-auto bg-[#0f0f0f] p-4">
          <MeetingInfoPopover meeting={meeting} visible={chromeVisible} />

          {mediaUnavailable && (
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-xs text-white">
              Joined without microphone and camera — others can&apos;t see or hear you.
            </div>
          )}

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
                isHost={isHost}
                onMuteAll={muteAll}
                onRemove={removeParticipant}
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

      <div
        className={`transition-opacity duration-300 ${
          chromeVisible || panelOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ControlBar
          audioEnabled={media.audioEnabled}
          videoEnabled={media.videoEnabled}
          mediaAvailable={!mediaUnavailable}
          participantCount={tileCount}
          sharing={screenStream !== null}
          isHost={isHost}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleRoster={() => setRosterOpen((open) => !open)}
          onToggleChat={() => setChatOpen((open) => !open)}
          onToggleShare={() => void toggleShare()}
          onLeave={onLeft}
          onEndForAll={() => {
            endMeetingForAll();
            onEnded();
          }}
        />
      </div>
    </div>
  );
}
