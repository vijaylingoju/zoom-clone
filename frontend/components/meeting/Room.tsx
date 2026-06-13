"use client";

import { Hand } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import { ChatPanel } from "@/components/meeting/ChatPanel";
import { MeetingInfoPopover } from "@/components/meeting/MeetingInfoPopover";
import { MobileTopBar } from "@/components/meeting/MobileTopBar";
import { RosterPanel } from "@/components/meeting/RosterPanel";
import { ViewMenu, type ViewMode } from "@/components/meeting/ViewMenu";
import { useActiveSpeaker } from "@/hooks/useActiveSpeaker";
import { useIsMobile } from "@/hooks/useIsMobile";
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

interface Tile {
  id: string;
  name: string;
  stream: MediaStream | null;
  muted: boolean;
  videoOff: boolean;
  isSelf: boolean;
  mirror?: boolean;
  handRaised: boolean;
}

function galleryColumns(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

function isScreenShareTile(tile: Tile, screenStream: MediaStream | null): boolean {
  if (tile.isSelf && screenStream) return true;
  return (
    tile.stream?.getVideoTracks().some((track) => {
      const label = track.label.toLowerCase();
      return label.includes("screen") || label.includes("window") || label.includes("display");
    }) ?? false
  );
}

interface TileRenderOptions {
  compact?: boolean;
  fill?: boolean;
  objectFit?: "cover" | "contain";
  showPinControl?: boolean;
}
const CHROME_HIDE_MS = 3500;

export function Room({ meeting, participant, media, onLeft, onEnded, onRemoved }: RoomProps) {
  const isHost = participant.role === "host";
  const isMobile = useIsMobile();
  const [rosterOpen, setRosterOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("speaker");
  const [hideSelf, setHideSelf] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [incomingVideoStopped, setIncomingVideoStopped] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessageCountRef = useRef(0);
  const chatOpenRef = useRef(false);

  const {
    peers,
    strugglingPeers,
    chatMessages,
    reactions,
    sendMediaState,
    sendChat,
    setVideoOverride,
    replaceTrack,
    pollAudioLevels,
    retryConnections,
    sendReaction,
    setHandRaised: broadcastHand,
    muteAll,
    removeParticipant,
    endMeetingForAll,
  } = useMeetingConnection(meeting.meeting_code, participant, media.stream, {
    onForceMute: () => {
      const tracks = media.stream?.getAudioTracks() ?? [];
      if (tracks.some((track) => track.enabled)) {
        media.toggleAudio();
        sendMediaState(false, media.videoEnabled);
      }
    },
    onRemoved,
    onMeetingEnded: onEnded,
  });

  const { activeId: activeSpeaker, resumeAudio } = useActiveSpeaker(
    useMemo(
      () => [
        { id: participant.id, stream: media.stream, isSelf: true },
        ...peers.map((p) => ({ id: p.id, stream: p.stream, isSelf: false })),
      ],
      [participant.id, media.stream, peers],
    ),
    pollAudioLevels,
  );

  // Remote audio elements need a user gesture or an explicit play() after tracks arrive.
  useEffect(() => {
    resumeAudio();
  }, [peers, resumeAudio]);

  // Unlock remote playback on any tap/click (host often joins before guests arrive).
  useEffect(() => {
    const unlock = () => resumeAudio();
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, [resumeAudio]);

  const reactionsByTile = useMemo(() => {
    const map: Record<string, { key: string; emoji: string }[]> = {};
    for (const r of reactions) {
      (map[r.participantId] ??= []).push({ key: r.key, emoji: r.emoji });
    }
    return map;
  }, [reactions]);

  const tiles: Tile[] = [
    {
      id: participant.id,
      name: `${participant.display_name}${isMobile ? "" : ` (You${screenStream ? ", sharing" : ""})`}`,
      stream: screenStream ?? media.stream,
      muted: !media.audioEnabled,
      videoOff: screenStream ? false : !media.videoEnabled,
      isSelf: true,
      mirror: screenStream ? false : undefined,
      handRaised,
    },
    ...peers.map((peer) => ({
      id: peer.id,
      name: peer.name,
      stream: peer.stream,
      muted: !peer.audioEnabled,
      videoOff: incomingVideoStopped ? true : !peer.videoEnabled,
      isSelf: false,
      handRaised: peer.handRaised,
    })),
  ];

  const tileCount = tiles.length;
  const panelOpen = rosterOpen || chatOpen;
  const chromeShown = chromeVisible || panelOpen || menuOpen;

  const poke = useCallback(() => {
    resumeAudio();
    setChromeVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, [resumeAudio]);

  useEffect(() => {
    poke();
    window.addEventListener("mousemove", poke);
    window.addEventListener("keydown", poke);
    window.addEventListener("touchstart", poke);
    return () => {
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("keydown", poke);
      window.removeEventListener("touchstart", poke);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [poke]);

  // pause auto-hide while a menu or panel is open
  useEffect(() => {
    if (panelOpen || menuOpen) {
      setChromeVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      poke();
    }
  }, [panelOpen, menuOpen, poke]);

  // Keep ref in sync with chatOpen state (for use in effects without re-subscribing)
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  // Track unread messages: increment when chat is closed and new messages arrive
  useEffect(() => {
    const newCount = chatMessages.length;
    if (newCount > prevMessageCountRef.current) {
      if (!chatOpenRef.current) {
        setUnreadMessages((prev) => prev + (newCount - prevMessageCountRef.current));
      }
    }
    prevMessageCountRef.current = newCount;
  }, [chatMessages.length]);

  function toggleAudio() {
    resumeAudio();
    media.toggleAudio();
    sendMediaState(!media.audioEnabled, media.videoEnabled);
  }

  async function toggleVideo() {
    const track = await media.toggleVideo();
    await replaceTrack(track, "video");
    sendMediaState(media.audioEnabled, track !== null);
  }

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    broadcastHand(next);
  }

  async function pickAudio(deviceId: string) {
    const track = await media.switchDevice("audio", deviceId);
    if (track) await replaceTrack(track);
  }

  async function pickVideo(deviceId: string) {
    const track = await media.switchDevice("video", deviceId);
    if (track && !screenStream) await replaceTrack(track);
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

  // On mount (WS connected), broadcast actual media state so other participants
  // see the correct audio/video status immediately (fixes: "joined without mic/camera")
  useEffect(() => {
    resumeAudio();
    const timer = setTimeout(() => {
      sendMediaState(media.audioEnabled, media.videoEnabled);
    }, 1000); // slight delay to ensure WS is fully open and roster handshake done
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

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
      handRaised,
      isSelf: true,
    },
    ...peers.map((peer) => ({
      id: peer.id,
      name: peer.name,
      role: peer.role,
      audioEnabled: peer.audioEnabled,
      videoEnabled: peer.videoEnabled,
      handRaised: peer.handRaised,
    })),
  ];

  const mediaUnavailable = media.permission !== "granted";

  const togglePin = useCallback(
    (id: string) => {
      setPinnedId((cur) => (cur === id ? null : id));
      if (!isMobile && viewMode === "gallery") setViewMode("speaker");
    },
    [isMobile, viewMode],
  );

  useEffect(() => {
    if (pinnedId && !tiles.some((tile) => tile.id === pinnedId)) {
      setPinnedId(null);
    }
  }, [pinnedId, tiles]);

  function renderTile(tile: Tile, className: string, options: TileRenderOptions = {}) {
    const { compact, fill, objectFit, showPinControl } = options;
    const pinned = pinnedId === tile.id;
    const fit = objectFit ?? (isScreenShareTile(tile, screenStream) ? "contain" : "cover");

    return (
      <div key={tile.id} className={className}>
        <VideoTile
          stream={tile.stream}
          name={tile.name}
          muted={tile.muted}
          videoOff={tile.videoOff}
          isSelf={tile.isSelf}
          mirror={tile.mirror}
          active={tile.id === activeSpeaker}
          pinned={pinned}
          handRaised={tile.handRaised}
          reactions={reactionsByTile[tile.id]}
          compact={compact}
          fill={fill}
          objectFit={fit}
          showPinControl={showPinControl}
          onPinToggle={showPinControl ? () => togglePin(tile.id) : undefined}
        />
      </div>
    );
  }

  const visible = hideSelf && tileCount > 1 ? tiles.filter((t) => !t.isSelf) : tiles;
  const mainId = pinnedId ?? activeSpeaker ?? visible.find((t) => !t.isSelf)?.id ?? visible[0]?.id;
  const mainTile = tiles.find((t) => t.id === mainId) ?? visible[0];
  const filmstrip = visible.filter((t) => t.id !== mainTile?.id);

  const useGallery = !isMobile && (viewMode === "gallery" || tileCount === 1);

  const mobileSpeakerView = (
    <div className="flex h-full w-full min-h-0 flex-col">
      {mainTile && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {renderTile(mainTile, "h-full w-full max-h-full max-w-full", {
            fill: true,
            showPinControl: true,
            objectFit: isScreenShareTile(mainTile, screenStream) ? "contain" : "cover",
          })}
        </div>
      )}
      {filmstrip.length > 0 && (
        <div className="flex h-[clamp(5.5rem,22vh,7.5rem)] shrink-0 gap-2 overflow-x-auto px-2 pb-2 pt-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
          {filmstrip.map((tile) =>
            renderTile(tile, "h-full w-[clamp(6.5rem,28vw,9rem)] shrink-0 snap-start", {
              compact: true,
              fill: true,
              showPinControl: true,
            }),
          )}
        </div>
      )}
    </div>
  );

  const desktopSpeakerView = (
    <div className="flex h-full w-full min-h-0 flex-col gap-2 sm:gap-3">
      {mainTile && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {renderTile(mainTile, "h-full w-full max-h-full max-w-full", {
            fill: true,
            showPinControl: true,
            objectFit: isScreenShareTile(mainTile, screenStream) ? "contain" : "cover",
          })}
        </div>
      )}
      {filmstrip.length > 0 && (
        <div className="flex h-[clamp(6rem,14vh,8.5rem)] shrink-0 justify-start gap-2 overflow-x-auto px-1 pb-1 sm:gap-3">
          {filmstrip.map((tile) =>
            renderTile(tile, "h-full w-[clamp(8rem,12vw,13rem)] shrink-0", {
              compact: true,
              fill: true,
              showPinControl: true,
            }),
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-room-bg">
      {isMobile && <MobileTopBar meeting={meeting} onLeave={onLeft} />}

      {/* Main content area: video stage + side panel side by side */}
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
        <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#0f0f0f] p-2 sm:p-4">
          {!isMobile && <MeetingInfoPopover meeting={meeting} visible={chromeShown} />}

          {!isMobile && (
            <div
              className={`absolute right-3 top-3 z-20 transition-opacity duration-300 ${
                chromeShown ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <ViewMenu
                mode={viewMode}
                hideSelf={hideSelf}
                onMode={setViewMode}
                onToggleHideSelf={() => setHideSelf((v) => !v)}
              />
            </div>
          )}

          {strugglingPeers.length > 0 && (
            <div className="absolute left-1/2 top-4 z-10 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2 rounded-lg bg-amber-950/90 px-4 py-3 text-center text-xs text-amber-50 sm:flex-row">
              <span>
                Having trouble seeing or hearing{" "}
                {strugglingPeers.map((p) => p.name).join(", ")}? Their network may need a relay
                connection.
              </span>
              <button
                type="button"
                onClick={() => {
                  resumeAudio();
                  retryConnections();
                }}
                className="shrink-0 rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400"
              >
                Reconnect media
              </button>
            </div>
          )}

          {mediaUnavailable && (
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 max-w-[90%] rounded-lg bg-black/80 px-4 py-2 text-center text-xs text-white">
              {media.permission === "skipped"
                ? "You joined without microphone and camera — others can't see or hear you."
                : media.permission === "denied"
                  ? "Microphone and camera access was blocked. Allow access in your browser settings to share audio/video."
                  : "No microphone or camera found on this device — others can't see or hear you."}
            </div>
          )}

          {isMobile ? (
            mobileSpeakerView
          ) : useGallery ? (
            <div
              className={`grid h-full w-full auto-rows-fr gap-1 sm:gap-2 ${galleryColumns(visible.length)}`}
            >
              {visible.map((tile) => (
                <div key={tile.id} className="min-h-0 min-w-0">
                  {renderTile(tile, "h-full w-full", {
                    fill: true,
                    compact: visible.length > 4,
                    showPinControl: true,
                  })}
                </div>
              ))}
            </div>
          ) : (
            desktopSpeakerView
          )}

          {/* Mobile: floating Lower Hand pill */}
          {isMobile && handRaised && (
            <button
              type="button"
              onClick={toggleHand}
              className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-5 py-2.5 text-sm text-white shadow-lg"
            >
              <span className="text-lg">✋</span>
              Lower hand
            </button>
          )}
        </main>

        {/* Desktop: side panel RIGHT of stage; Mobile: full-screen overlay */}
        {panelOpen && (
          <aside
            className={
              isMobile
                ? "fixed inset-0 z-40 flex flex-col bg-[#1f1f1f]"
                : "flex w-80 shrink-0 flex-col border-l border-white/10 bg-[#1f1f1f]"
            }
          >
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
        className={`relative z-40 shrink-0 transition-opacity duration-300 ${
          isMobile || chromeShown ? "opacity-100" : "opacity-0 hover:opacity-100"
        }`}
      >
        <ControlBar
          audioEnabled={media.audioEnabled}
          videoEnabled={media.videoEnabled}
          mediaAvailable={!mediaUnavailable}
          participantCount={tileCount}
          sharing={screenStream !== null}
          isHost={isHost}
          handRaised={handRaised}
          incomingVideoStopped={incomingVideoStopped}
          unreadMessages={unreadMessages}
          audioDevices={media.audioDevices}
          videoDevices={media.videoDevices}
          currentAudioId={media.currentAudioId}
          currentVideoId={media.currentVideoId}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onPickAudio={pickAudio}
          onPickVideo={pickVideo}
          onToggleRoster={() => setRosterOpen((open) => !open)}
          onToggleChat={() => {
            setChatOpen((open) => !open);
            setUnreadMessages(0);
          }}
          onToggleShare={() => void toggleShare()}
          onReact={sendReaction}
          onToggleHand={toggleHand}
          onToggleIncomingVideo={() => setIncomingVideoStopped((v) => !v)}
          onLeave={onLeft}
          onEndForAll={() => {
            endMeetingForAll();
            onEnded();
          }}
          onMenuOpenChange={setMenuOpen}
        />
      </div>
    </div>
  );
}
