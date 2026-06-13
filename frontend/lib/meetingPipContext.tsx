"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

export interface MeetingPopoutControls {
  meetingCode: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  mediaAvailable: boolean;
  stream: MediaStream | null;
  toggleAudio: () => void;
  toggleVideo: () => void;
  onLeave: () => void;
}

interface MeetingPipContextValue {
  roomSlot: ReactNode | null;
  setRoomSlot: (node: ReactNode | null) => void;
  poppedOut: boolean;
  setPoppedOut: (value: boolean) => void;
  controls: MeetingPopoutControls | null;
  controlsRef: MutableRefObject<MeetingPopoutControls | null>;
  setControls: (controls: MeetingPopoutControls | null) => void;
  /** Manual pop-out → dashboard. */
  popOut: () => void;
  /** Show mini window without leaving meeting page (tab blur). */
  showPopout: () => void;
  /** Hide mini window when returning to meeting tab. */
  hidePopout: () => void;
  expand: (meetingCode: string) => void;
  clearSession: () => void;
  keepAliveRef: MutableRefObject<boolean>;
  inMeetingRef: MutableRefObject<boolean>;
}

const MeetingPipContext = createContext<MeetingPipContextValue | null>(null);

export function MeetingPipProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [roomSlot, setRoomSlot] = useState<ReactNode | null>(null);
  const [poppedOut, setPoppedOut] = useState(false);
  const [controls, setControlsState] = useState<MeetingPopoutControls | null>(null);
  const controlsRef = useRef<MeetingPopoutControls | null>(null);
  const keepAliveRef = useRef(false);
  const inMeetingRef = useRef(false);

  const setControls = useCallback((next: MeetingPopoutControls | null) => {
    controlsRef.current = next;
    setControlsState((prev) => {
      if (prev === next) return prev;
      if (prev === null || next === null) return next;
      if (
        prev.meetingCode === next.meetingCode &&
        prev.displayName === next.displayName &&
        prev.audioEnabled === next.audioEnabled &&
        prev.videoEnabled === next.videoEnabled &&
        prev.mediaAvailable === next.mediaAvailable &&
        prev.stream === next.stream
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const showPopout = useCallback(() => {
    if (!controlsRef.current) return;
    keepAliveRef.current = true;
    setPoppedOut(true);
  }, []);

  const hidePopout = useCallback(() => {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/meeting/")) {
      return;
    }
    keepAliveRef.current = false;
    setPoppedOut(false);
  }, []);

  const popOut = useCallback(() => {
    keepAliveRef.current = true;
    inMeetingRef.current = false;
    setPoppedOut(true);
    router.push("/");
  }, [router]);

  const expand = useCallback(
    (meetingCode: string) => {
      keepAliveRef.current = false;
      setPoppedOut(false);
      inMeetingRef.current = true;
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/meeting/")) {
        router.push(`/meeting/${meetingCode}`);
      }
    },
    [router],
  );

  const clearSession = useCallback(() => {
    keepAliveRef.current = false;
    inMeetingRef.current = false;
    controlsRef.current = null;
    setRoomSlot(null);
    setControlsState(null);
    setPoppedOut(false);
  }, []);

  const value = useMemo(
    () => ({
      roomSlot,
      setRoomSlot,
      poppedOut,
      setPoppedOut,
      controls,
      controlsRef,
      setControls,
      popOut,
      showPopout,
      hidePopout,
      expand,
      clearSession,
      keepAliveRef,
      inMeetingRef,
    }),
    [
      roomSlot,
      poppedOut,
      controls,
      setControls,
      popOut,
      showPopout,
      hidePopout,
      expand,
      clearSession,
    ],
  );

  return <MeetingPipContext.Provider value={value}>{children}</MeetingPipContext.Provider>;
}

export function useMeetingPip() {
  const ctx = useContext(MeetingPipContext);
  if (!ctx) throw new Error("useMeetingPip must be used within MeetingPipProvider");
  return ctx;
}

export function useMeetingPipOptional() {
  return useContext(MeetingPipContext);
}
