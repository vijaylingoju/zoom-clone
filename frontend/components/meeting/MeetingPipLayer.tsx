"use client";

import { useEffect } from "react";

import { MeetingPopout } from "@/components/meeting/MeetingPopout";
import { useMeetingPip } from "@/lib/meetingPipContext";

/** Renders the persistent meeting room slot and floating pop-out window. */
export function MeetingPipLayer() {
  const {
    roomSlot,
    poppedOut,
    controls,
    controlsRef,
    expand,
    popOut,
    hidePopout,
    inMeetingRef,
  } = useMeetingPip();

  // Tab/window blur → go to dashboard + show pop-out (visible when user returns to this tab).
  useEffect(() => {
    if (!roomSlot) return;

    function onVisibilityChange() {
      if (!controlsRef.current) return;

      if (document.hidden) {
        if (!poppedOut && inMeetingRef.current) {
          popOut();
        }
        return;
      }

      if (window.location.pathname.startsWith("/meeting/")) {
        hidePopout();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [roomSlot, controlsRef, popOut, hidePopout, inMeetingRef, poppedOut]);

  if (!roomSlot) return null;

  const activeControls = controlsRef.current ?? controls;

  return (
    <>
      <div
        className={
          poppedOut
            ? "pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
            : "fixed inset-0 z-[200]"
        }
        aria-hidden={poppedOut}
      >
        {roomSlot}
      </div>

      {poppedOut && activeControls && (
        <MeetingPopout
          displayName={activeControls.displayName}
          mediaAvailable={activeControls.mediaAvailable}
          stream={activeControls.stream}
          audioEnabled={activeControls.audioEnabled}
          videoEnabled={activeControls.videoEnabled}
          controlsRef={controlsRef}
          onExpand={() => expand(activeControls.meetingCode)}
          onClose={() => controlsRef.current?.onLeave()}
        />
      )}
    </>
  );
}
