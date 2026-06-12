"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { Lobby } from "@/components/meeting/Lobby";
import { Room } from "@/components/meeting/Room";
import { api, ApiError } from "@/lib/api";
import type { Participant } from "@/lib/types";
import { useLocalMedia } from "@/hooks/useLocalMedia";

type Stage = "lobby" | "room" | "left";

function DarkNotice({ title, detail, onBack }: { title: string; detail?: string; onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-room-bg px-4 text-white">
      <h1 className="text-xl font-semibold">{title}</h1>
      {detail && <p className="mt-2 text-sm text-white/60">{detail}</p>}
      <button
        type="button"
        onClick={onBack}
        className="mt-8 rounded-lg bg-zoom-blue px-6 py-2 text-sm font-medium transition hover:bg-zoom-blue-hover"
      >
        Back to dashboard
      </button>
    </div>
  );
}

export default function MeetingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const media = useLocalMedia();

  const [stage, setStage] = useState<Stage>("lobby");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { data: meeting, error, isLoading } = useQuery({
    queryKey: ["meeting", code],
    queryFn: () => api.validateMeeting(code),
    retry: false,
  });

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });

  async function join(displayName: string) {
    setJoining(true);
    setJoinError(null);
    try {
      const result = await api.joinMeeting(code, displayName);
      setParticipant(result.participant);
      setStage("room");
    } catch (err) {
      setJoinError(
        err instanceof ApiError && err.status === 410
          ? "This meeting has ended."
          : "Could not join the meeting. Please try again.",
      );
    } finally {
      setJoining(false);
    }
  }

  async function leave() {
    if (participant) {
      try {
        await api.leaveMeeting(code, participant.id);
      } catch {
        // leaving must always succeed locally even if the API call fails
      }
    }
    media.stop();
    setStage("left");
  }

  function backToDashboard() {
    media.stop();
    router.push("/");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-room-bg text-white/70">
        Loading meeting…
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <DarkNotice
        title="Meeting not found"
        detail={`The meeting ID ${code} does not exist.`}
        onBack={backToDashboard}
      />
    );
  }

  if (!meeting) {
    return (
      <DarkNotice
        title="Something went wrong"
        detail="Could not load the meeting. Is the backend running?"
        onBack={backToDashboard}
      />
    );
  }

  if (meeting.status === "ended" || meeting.status === "cancelled") {
    return (
      <DarkNotice
        title={`This meeting has ${meeting.status}`}
        detail={`Meeting ID: ${meeting.meeting_code}`}
        onBack={backToDashboard}
      />
    );
  }

  if (stage === "left") {
    return <DarkNotice title="You left the meeting" onBack={backToDashboard} />;
  }

  if (stage === "room" && participant) {
    return <Room meeting={meeting} participant={participant} media={media} onLeave={leave} />;
  }

  const storedName =
    typeof window !== "undefined" ? sessionStorage.getItem("zc_display_name") : null;

  return (
    <Lobby
      meeting={meeting}
      media={media}
      defaultName={storedName ?? user?.name ?? ""}
      joining={joining}
      joinError={joinError}
      onJoin={join}
    />
  );
}
