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

function galleryColumns(count: number, mobile: boolean): string {
  if (mobile) return "grid-cols-2";
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-3";
}

const MOBILE_PAGE_SIZE = 4;
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
  const [mobilePage, setMobilePage] = useState(0);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessageCountRef = useRef(0);
  const chatOpenRef = useRef(false);

  const {
    peers,
    chatMessages,
    reactions,
    sendMediaState,
    sendChat,
    setVideoOverride,
    replaceTrack,
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

  const activeSpeaker = useActiveSpeaker(
    useMemo(
      () => [{ id: participant.id, stream: media.stream }, ...peers.map((p) => ({ id: p.id, stream: p.stream }))],
      [participant.id, media.stream, peers],
    ),
  );

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
    setChromeVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, []);

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
    media.toggleAudio();
    sendMediaState(!media.audioEnabled, media.videoEnabled);
  }

  function toggleVideo() {
    media.toggleVideo();
    sendMediaState(media.audioEnabled, !media.videoEnabled);
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

  function renderTile(tile: Tile, className: string, compact?: boolean) {
    return (
      <div
        key={tile.id}
        className={className}
        onDoubleClick={() => !isMobile && setPinnedId((cur) => (cur === tile.id ? null : tile.id))}
        title={isMobile ? undefined : "Double-click to pin / unpin"}
      >
        <VideoTile
          stream={tile.stream}
          name={tile.name}
          muted={tile.muted}
          videoOff={tile.videoOff}
          isSelf={tile.isSelf}
          mirror={tile.mirror}
          active={tile.id === activeSpeaker}
          handRaised={tile.handRaised}
          reactions={reactionsByTile[tile.id]}
          compact={compact}
        />
      </div>
    );
  }

  const visible = hideSelf && tileCount > 1 ? tiles.filter((t) => !t.isSelf) : tiles;
  const mainId = pinnedId ?? activeSpeaker ?? visible.find((t) => !t.isSelf)?.id ?? visible[0]?.id;
  const mainTile = tiles.find((t) => t.id === mainId) ?? visible[0];
  const filmstrip = visible.filter((t) => t.id !== mainTile?.id);

  const mobilePages = Math.max(1, Math.ceil(visible.length / MOBILE_PAGE_SIZE));
  const mobilePageTiles = visible.slice(
    mobilePage * MOBILE_PAGE_SIZE,
    mobilePage * MOBILE_PAGE_SIZE + MOBILE_PAGE_SIZE,
  );

  const useGallery = isMobile || viewMode === "gallery" || tileCount === 1;

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

          {mediaUnavailable && (
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 max-w-[90%] rounded-lg bg-black/80 px-4 py-2 text-center text-xs text-white">
              {media.permission === "skipped"
                ? "You joined without microphone and camera — others can't see or hear you."
                : media.permission === "denied"
                  ? "Microphone and camera access was blocked. Allow access in your browser settings to share audio/video."
                  : "No microphone or camera found on this device — others can't see or hear you."}
            </div>
          )}

          {useGallery ? (
            <div className="flex h-full w-full flex-col">
              <div className={`grid h-full w-full flex-1 gap-1 sm:gap-3 ${galleryColumns(visible.length, isMobile)}`}>
                {(isMobile ? mobilePageTiles : visible).map((tile) =>
                  renderTile(tile, isMobile ? "min-h-0" : "", isMobile),
                )}
              </div>
              {isMobile && mobilePages > 1 && (
                <div className="flex shrink-0 justify-center gap-2 py-3">
                  {Array.from({ length: mobilePages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Page ${i + 1}`}
                      onClick={() => setMobilePage(i)}
                      className={`h-2 w-2 rounded-full transition ${
                        i === mobilePage ? "bg-white" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col gap-3">
              {mainTile && (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  {renderTile(mainTile, "h-full w-full max-w-5xl")}
                </div>
              )}
              {filmstrip.length > 0 && (
                <div className="flex shrink-0 justify-center gap-3 overflow-x-auto pb-1">
                  {filmstrip.map((tile) => renderTile(tile, "w-44 shrink-0 sm:w-52"))}
                </div>
              )}
            </div>
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
