"use client";

import { Room } from "@/components/meeting/Room";
import { useLocalMedia, type MediaBootstrap } from "@/hooks/useLocalMedia";
import { useMeetingPip } from "@/lib/meetingPipContext";
import type { Meeting, Participant } from "@/lib/types";

interface MeetingSessionProps {
  meeting: Meeting;
  participant: Participant;
  bootstrap: MediaBootstrap;
  onLeft: () => void | Promise<void>;
  onEnded: () => void;
  onRemoved: () => void;
}

/** Persistent meeting room — owns live media so toggles sync with pop-out. */
export function MeetingSession({
  meeting,
  participant,
  bootstrap,
  onLeft,
  onEnded,
  onRemoved,
}: MeetingSessionProps) {
  const { keepAliveRef } = useMeetingPip();
  const media = useLocalMedia({ keepAliveRef, bootstrap });

  return (
    <Room
      meeting={meeting}
      participant={participant}
      media={media}
      onLeft={() => void onLeft()}
      onEnded={onEnded}
      onRemoved={onRemoved}
    />
  );
}
