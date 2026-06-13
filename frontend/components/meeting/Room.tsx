"use client";

import { Hand, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import { ChatPanel } from "@/components/meeting/ChatPanel";
import { MeetingTopBar } from "@/components/meeting/MeetingTopBar";
import { MeetingReactions } from "@/components/meeting/MeetingReactions";
import { MeetingToasts } from "@/components/meeting/MeetingToasts";
import { RosterPanel } from "@/components/meeting/RosterPanel";
import type { ViewMode } from "@/components/meeting/ViewMenu";
import { useActiveSpeaker } from "@/hooks/useActiveSpeaker";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMeetingConnection } from "@/hooks/useMeetingConnection";
import type { LocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingPipOptional } from "@/lib/meetingPipContext";
import { readMediaFlags } from "@/lib/mediaState";
import type { Meeting, Participant } from "@/lib/types";
import { playChatSound, playHandSound, playJoinSound, primeMeetingSounds } from "@/lib/meetingSounds";

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
  const pip = useMeetingPipOptional();
  const setControls = pip?.setControls;
  const keepAliveRef = pip?.keepAliveRef;
  const [rosterOpen, setRosterOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("speaker");
  const [hideSelf, setHideSelf] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [incomingVideoStopped, setIncomingVideoStopped] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNotice, setMobileNotice] = useState<string | null>(null);
  const [cameraBannerDismissed, setCameraBannerDismissed] = useState(false);
  const [micBannerDismissed, setMicBannerDismissed] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatOpenRef = useRef(false);
  const playedToastsRef = useRef(new Set<string>());
  const prevPeerHandsRef = useRef<Record<string, boolean>>({});

  const {
    peers,
    strugglingPeers,
    chatMessages,
    reactions,
    toasts,
    unreadChat,
    dismissToast,
    clearUnreadChat,
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
      void (async () => {
        const { audioEnabled } = media.getLiveFlags();
        if (!audioEnabled) return;
        await media.toggleAudio();
        const flags = media.getLiveFlags();
        sendMediaState(flags.audioEnabled, flags.videoEnabled);
      })();
    },
    onRemoved,
    onMeetingEnded: onEnded,
  });

  const visibleToasts = useMemo(
    () => toasts.filter((toast) => toast.type !== "chat" || !chatOpen),
    [toasts, chatOpen],
  );

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

  // Prime notification audio as soon as the room mounts (user already clicked Join).
  useEffect(() => {
    primeMeetingSounds();
  }, []);

  // Unlock remote playback on any tap/click (host often joins before guests arrive).
  useEffect(() => {
    const unlock = () => {
      resumeAudio();
      primeMeetingSounds();
    };
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, [resumeAudio]);

  useEffect(() => {
    for (const toast of toasts) {
      if (playedToastsRef.current.has(toast.id)) continue;
      playedToastsRef.current.add(toast.id);
      if (toast.type === "join") void playJoinSound();
      else if (toast.type === "chat" && !chatOpenRef.current) void playChatSound();
    }
  }, [toasts]);

  useEffect(() => {
    for (const peer of peers) {
      const wasRaised = prevPeerHandsRef.current[peer.id] ?? false;
      if (peer.handRaised && !wasRaised) void playHandSound();
      prevPeerHandsRef.current[peer.id] = peer.handRaised;
    }
  }, [peers]);

  const openChat = useCallback(() => {
    setRosterOpen(false);
    setChatOpen(true);
    clearUnreadChat();
  }, [clearUnreadChat]);

  const openRoster = useCallback(() => {
    setChatOpen(false);
    setRosterOpen(true);
  }, []);

  const displayedUnread = chatOpen ? 0 : unreadChat;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const {
    audioEnabled: liveAudio,
    videoEnabled: liveVideo,
    hasAudioTrack,
    hasVideoTrack,
  } = readMediaFlags(media);
  const canControlMedia = media.permission === "granted" || media.permission === "skipped";
  const showMicAccessBanner = !micBannerDismissed && canControlMedia && !hasAudioTrack;
  const showCameraAccessBanner = !cameraBannerDismissed && canControlMedia && !hasVideoTrack;
  const mediaFullyBlocked =
    (media.permission === "denied" || media.permission === "unavailable") &&
    !hasAudioTrack &&
    !hasVideoTrack;

  const tiles: Tile[] = [
    {
      id: participant.id,
      name: `${participant.display_name}${isMobile ? "" : ` (You${screenStream ? ", sharing" : ""})`}`,
      stream: screenStream ?? media.stream,
      muted: !liveAudio,
      videoOff: screenStream ? false : !liveVideo,
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

  async function toggleAudio() {
    resumeAudio();
    const track = await media.toggleAudio();
    if (track) await replaceTrack(track, "audio");
    const { audioEnabled, videoEnabled } = media.getLiveFlags();
    sendMediaState(audioEnabled, videoEnabled);
  }

  async function toggleVideo() {
    const track = await media.toggleVideo();
    await replaceTrack(track, "video");
    const { audioEnabled, videoEnabled } = media.getLiveFlags();
    sendMediaState(audioEnabled, videoEnabled);
  }

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    broadcastHand(next);
    if (next) void playHandSound();
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
    const { audioEnabled, videoEnabled } = media.getLiveFlags();
    sendMediaState(audioEnabled, videoEnabled);
  }

  async function toggleShare() {
    if (screenStreamRef.current) {
      stopShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMobileNotice("Screen sharing is not supported in this mobile browser.");
      setTimeout(() => setMobileNotice(null), 4000);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      track.onended = stopShare;
      screenStreamRef.current = display;
      setScreenStream(display);
      await setVideoOverride(track);
      const { audioEnabled } = media.getLiveFlags();
      sendMediaState(audioEnabled, true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      setMobileNotice("Could not start screen sharing on this device.");
      setTimeout(() => setMobileNotice(null), 4000);
    }
  }

  // On mount (WS connected), broadcast actual media state so other participants
  // see the correct audio/video status immediately (fixes: "joined without mic/camera")
  useEffect(() => {
    resumeAudio();
    const timer = setTimeout(() => {
      const { audioEnabled, videoEnabled } = media.getLiveFlags();
      sendMediaState(audioEnabled, videoEnabled);
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
      audioEnabled: liveAudio,
      videoEnabled: liveVideo,
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

  const mediaUnavailable = mediaFullyBlocked;

  const onLeftRef = useRef(onLeft);
  onLeftRef.current = onLeft;
  const toggleAudioRef = useRef(toggleAudio);
  toggleAudioRef.current = toggleAudio;
  const toggleVideoRef = useRef(toggleVideo);
  toggleVideoRef.current = toggleVideo;

  useEffect(() => {
    if (!setControls) return;
    setControls({
      meetingCode: meeting.meeting_code,
      displayName: participant.display_name,
      audioEnabled: liveAudio,
      videoEnabled: liveVideo,
      mediaAvailable: canControlMedia,
      stream: media.stream,
      toggleAudio: () => void toggleAudioRef.current(),
      toggleVideo: () => void toggleVideoRef.current(),
      onLeave: () => onLeftRef.current(),
    });
  }, [
    setControls,
    meeting.meeting_code,
    participant.display_name,
    liveAudio,
    liveVideo,
    media.stream,
    canControlMedia,
  ]);

  useEffect(() => {
    return () => {
      if (!keepAliveRef?.current) setControls?.(null);
    };
  }, [setControls, keepAliveRef]);

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
    <div className="flex h-screen flex-col bg-black">
      {/* Main content area: video stage + side panel side by side */}
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
        <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#2d2d2d] p-0 sm:p-2">
          <MeetingTopBar
            meeting={meeting}
            displayName={participant.display_name}
            visible={chromeShown}
            viewMode={viewMode}
            hideSelf={hideSelf}
            onViewMode={setViewMode}
            onToggleHideSelf={() => setHideSelf((v) => !v)}
            onPopOut={isMobile ? undefined : () => pip?.popOut()}
          />

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

          {(showMicAccessBanner || showCameraAccessBanner) && (
            <div className="absolute inset-x-0 top-9 z-[28] flex flex-col items-center gap-2 px-3 pt-2 sm:top-10">
              {showMicAccessBanner && (
                <div className="flex w-full max-w-xl items-center gap-2.5 rounded-lg bg-[#2d2d2d] px-4 py-2.5 text-sm text-white shadow-lg">
                  <TriangleAlert size={16} className="shrink-0 text-amber-400" />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug">
                    Please enable access to your{" "}
                    <button
                      type="button"
                      onClick={() => void toggleAudio()}
                      className="font-medium text-[#4f9cf9] hover:underline"
                    >
                      microphone
                    </button>{" "}
                    so others can hear you.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMicBannerDismissed(true)}
                    className="shrink-0 rounded p-1 text-white/70 hover:bg-white/10"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {showCameraAccessBanner && (
                <div className="flex w-full max-w-xl items-center gap-2.5 rounded-lg bg-[#2d2d2d] px-4 py-2.5 text-sm text-white shadow-lg">
                  <TriangleAlert size={16} className="shrink-0 text-amber-400" />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug">
                    {hasAudioTrack ? (
                      <>
                        Camera access is off.{" "}
                        <button
                          type="button"
                          onClick={() => void toggleVideo()}
                          className="font-medium text-[#4f9cf9] hover:underline"
                        >
                          Turn on camera
                        </button>{" "}
                        when ready — your microphone is still on.
                      </>
                    ) : (
                      <>
                        Please enable access to your{" "}
                        <button
                          type="button"
                          onClick={() => void toggleVideo()}
                          className="font-medium text-[#4f9cf9] hover:underline"
                        >
                          camera
                        </button>{" "}
                        for the best experience.
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCameraBannerDismissed(true)}
                    className="shrink-0 rounded p-1 text-white/70 hover:bg-white/10"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {mediaFullyBlocked && (
            <div className="absolute inset-x-0 top-9 z-[28] flex justify-center px-3 pt-2 sm:top-10">
              <div className="max-w-xl rounded-lg bg-black/80 px-4 py-2 text-center text-xs text-white">
                {media.permission === "denied"
                  ? "Microphone and camera access was blocked. Allow access in your browser settings to share audio or video."
                  : "No microphone or camera was found on this device."}
              </div>
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

          <MeetingReactions reactions={reactions} />

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

        {/* Desktop: side panel RIGHT of stage; Mobile: full-screen portal overlay */}
        {!isMobile && panelOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-[#1f1f1f]">
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

      {isMobile && mobileNotice && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[70] max-w-[90%] -translate-x-1/2 rounded-lg bg-black/85 px-4 py-2 text-center text-xs text-white">
          {mobileNotice}
        </div>
      )}

      {isMobile &&
        panelOpen &&
        portalReady &&
        createPortal(
          <div className="fixed inset-0 z-[250] flex flex-col bg-[#1f1f1f]">
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
          </div>,
          document.body,
        )}

      <div
        className={`relative z-40 shrink-0 transition-opacity duration-300 ${
          isMobile || chromeShown ? "opacity-100" : "opacity-0 hover:opacity-100"
        }`}
      >
        <ControlBar
          audioEnabled={liveAudio}
          videoEnabled={liveVideo}
          mediaAvailable={canControlMedia}
          participantCount={tileCount}
          sharing={screenStream !== null}
          isHost={isHost}
          handRaised={handRaised}
          incomingVideoStopped={incomingVideoStopped}
          unreadMessages={displayedUnread}
          audioDevices={media.audioDevices}
          videoDevices={media.videoDevices}
          currentAudioId={media.currentAudioId}
          currentVideoId={media.currentVideoId}
          onToggleAudio={() => void toggleAudio()}
          onToggleVideo={toggleVideo}
          onPickAudio={pickAudio}
          onPickVideo={pickVideo}
          onToggleRoster={() => setRosterOpen((open) => !open)}
          onOpenParticipants={openRoster}
          onOpenChat={openChat}
          onToggleChat={() => {
            setChatOpen((open) => {
              if (!open) clearUnreadChat();
              return !open;
            });
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

      <MeetingToasts
        toasts={visibleToasts}
        onDismiss={dismissToast}
        onOpenChat={openChat}
      />
    </div>
  );
}
