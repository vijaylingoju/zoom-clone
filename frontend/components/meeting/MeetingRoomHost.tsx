"use client";

import { useEffect, useRef } from "react";

import { MeetingSession } from "@/components/meeting/MeetingSession";
import type { MediaBootstrap } from "@/hooks/useLocalMedia";
import { useMeetingPip } from "@/lib/meetingPipContext";
import type { Meeting, Participant } from "@/lib/types";

interface MeetingRoomHostProps {
  meeting: Meeting;
  participant: Participant;
  mediaBootstrap: MediaBootstrap;
  onLeft: () => void | Promise<void>;
  onEnded: () => void;
  onRemoved: () => void;
}

/** Keeps the meeting session mounted in the global PiP layer while popped out. */
export function MeetingRoomHost({
  meeting,
  participant,
  mediaBootstrap,
  onLeft,
  onEnded,
  onRemoved,
}: MeetingRoomHostProps) {
  const { setRoomSlot, clearSession, keepAliveRef, inMeetingRef } = useMeetingPip();
  const bootstrapRef = useRef(mediaBootstrap);
  bootstrapRef.current = mediaBootstrap;

  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;
  const participantRef = useRef(participant);
  participantRef.current = participant;
  const callbacksRef = useRef({ onLeft, onEnded, onRemoved });
  callbacksRef.current = { onLeft, onEnded, onRemoved };

  const sessionKey = `${meeting.meeting_code}-${participant.id}`;

  // Mount session once per meeting/participant — avoid re-running on parent re-renders.
  useEffect(() => {
    setRoomSlot(
      <MeetingSession
        key={sessionKey}
        meeting={meetingRef.current}
        participant={participantRef.current}
        bootstrap={bootstrapRef.current}
        onLeft={() => void callbacksRef.current.onLeft()}
        onEnded={() => callbacksRef.current.onEnded()}
        onRemoved={() => callbacksRef.current.onRemoved()}
      />,
    );
  }, [sessionKey, setRoomSlot]);

  // Clear only when this host unmounts (leave/end), not when slot effect deps churn.
  useEffect(() => {
    return () => {
      if (!keepAliveRef.current) {
        clearSession();
      }
    };
  }, [clearSession, keepAliveRef]);

  useEffect(() => {
    inMeetingRef.current = true;
    return () => {
      if (!keepAliveRef.current) {
        inMeetingRef.current = false;
      }
    };
  }, [inMeetingRef, keepAliveRef]);

  return null;
}
