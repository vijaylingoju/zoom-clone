"use client";

import { useQuery } from "@tanstack/react-query";
import { Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { Room } from "@/components/meeting/Room";
import { api, ApiError, hostKeyFor } from "@/lib/api";
import type { Participant } from "@/lib/types";
import { useLocalMedia } from "@/hooks/useLocalMedia";

type Stage = "name" | "permission" | "passcode" | "joining" | "room" | "left" | "ended" | "removed";

function urlParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function DarkScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-room-bg px-4 text-white">
      {children}
    </div>
  );
}

function DarkNotice({
  title,
  detail,
  onBack,
  onRejoin,
}: {
  title: string;
  detail?: string;
  onBack: () => void;
  onRejoin?: () => void;
}) {
  return (
    <DarkScreen>
      <h1 className="text-xl font-semibold">{title}</h1>
      {detail && <p className="mt-2 text-sm text-white/60">{detail}</p>}
      <div className="mt-8 flex items-center gap-3">
        {onRejoin && (
          <button
            type="button"
            onClick={onRejoin}
            className="rounded-lg bg-zoom-blue px-6 py-2 text-sm font-medium transition hover:bg-zoom-blue-hover"
          >
            Rejoin
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className={`rounded-lg px-6 py-2 text-sm font-medium transition ${
            onRejoin
              ? "border border-white/25 hover:bg-white/10"
              : "bg-zoom-blue hover:bg-zoom-blue-hover"
          }`}
        >
          Back to dashboard
        </button>
      </div>
    </DarkScreen>
  );
}

export default function MeetingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const media = useLocalMedia();
  const isCreator = typeof window !== "undefined" && hostKeyFor(code) !== null;

  const [stage, setStage] = useState<Stage>(isCreator ? "permission" : "name");
  const [participant, setParticipant] = useState<Participant | null>(null);
  // Guests: only restore their own previously-typed guest name, never the host's account name.
  // If the user is a creator (host), their name comes from /api/me, not from sessionStorage.
  const [guestName, setGuestName] = useState(
    () =>
      isCreator
        ? ""
        : (typeof window === "undefined" ? "" : (sessionStorage.getItem("zc_display_name") ?? "")),
  );
  const [passcode, setPasscode] = useState(() => urlParam("pwd") ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);

  const { data: meeting, error, isLoading } = useQuery({
    queryKey: ["meeting", code],
    queryFn: () => api.validateMeeting(code),
    retry: false,
  });

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const displayName = isCreator ? (user?.name ?? "Host") : guestName.trim();

  async function join() {
    setStage("joining");
    setJoinError(null);
    try {
      const result = await api.joinMeeting(code, displayName, hostKeyFor(code), passcode || null);
      sessionStorage.setItem("zc_display_name", displayName);
      setParticipant(result.participant);
      setStage("room");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setStage("passcode");
        setJoinError(passcode ? "Invalid passcode. Try again." : null);
      } else if (err instanceof ApiError && err.status === 410) {
        setStage("ended");
      } else {
        setStage("permission");
        setJoinError("Could not join the meeting. Please try again.");
      }
    }
  }

  function backToDashboard() {
    media.stop();
    router.push("/");
  }

  if (isLoading) {
    return <DarkScreen>Loading meeting…</DarkScreen>;
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

  if (stage !== "room" && (meeting.status === "ended" || meeting.status === "cancelled") && !meeting.is_pmi) {
    return (
      <DarkNotice
        title={`This meeting has ${meeting.status}`}
        detail={`Meeting ID: ${meeting.meeting_code}`}
        onBack={backToDashboard}
      />
    );
  }

  switch (stage) {
    case "name":
      return (
        <DarkScreen>
          <form
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-ink"
            onSubmit={(e) => {
              e.preventDefault();
              setStage("permission");
            }}
          >
            <h1 className="text-center text-lg font-semibold">Enter your name to join</h1>
            <p className="mt-1 text-center text-sm text-ink-soft">{meeting.title}</p>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              required
              autoFocus
              aria-label="Your name"
              className="mt-6 w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20"
            />
            <button
              type="submit"
              disabled={!guestName.trim()}
              className="mt-4 w-full rounded-lg bg-zoom-blue py-2.5 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-40"
            >
              Continue
            </button>
          </form>
        </DarkScreen>
      );

    case "permission":
      return (
        <DarkScreen>
          <div className="absolute bottom-6 left-6 rounded bg-black/60 px-2 py-1 text-xs text-white/90">
          {displayName || "Guest"}
          </div>
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center text-ink shadow-2xl">
            <div className="mx-auto mb-5 flex h-28 w-44 items-center justify-center rounded-xl bg-[#EEF2FB]">
              <Video size={40} className="text-zoom-blue" strokeWidth={1.4} />
            </div>
            <h1 className="text-lg font-semibold">
              Do you want people to see you in the meeting?
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              You can still turn off your microphone and camera anytime in the meeting
            </p>
            {joinError && <p className="mt-2 text-sm text-red-600">{joinError}</p>}
            <button
              type="button"
              onClick={async () => {
                await media.acquire();
                await join();
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zoom-blue px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zoom-blue-hover"
            >
              <Video size={16} />
              Use microphone and camera
            </button>
            <button
              type="button"
              onClick={() => {
                media.skip();
                void join();
              }}
              className="mt-4 block w-full text-sm font-medium text-zoom-blue hover:underline"
            >
              Continue without microphone and camera
            </button>
          </div>
        </DarkScreen>
      );

    case "passcode":
      return (
        <DarkScreen>
          <form
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-ink"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <h1 className="text-center text-lg font-semibold">Enter meeting passcode</h1>
            <p className="mt-1 text-center text-sm text-ink-soft">{meeting.title}</p>
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              maxLength={10}
              required
              autoFocus
              aria-label="Meeting passcode"
              className="mt-6 w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20"
            />
            {joinError && <p className="mt-2 text-sm text-red-600">{joinError}</p>}
            <button
              type="submit"
              disabled={!passcode.trim()}
              className="mt-4 w-full rounded-lg bg-zoom-blue py-2.5 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-40"
            >
              Join Meeting
            </button>
          </form>
        </DarkScreen>
      );

    case "joining":
      return <DarkScreen>Joining…</DarkScreen>;

    case "left":
      return (
        <DarkNotice
          title="You left the meeting"
          onBack={backToDashboard}
          onRejoin={() => window.location.reload()}
        />
      );

    case "ended":
      return (
        <DarkNotice
          title="The meeting has ended"
          detail={meeting.is_pmi ? "The host can restart this room at any time." : undefined}
          onBack={backToDashboard}
          onRejoin={meeting.is_pmi ? () => window.location.reload() : undefined}
        />
      );

    case "removed":
      return <DarkNotice title="You were removed from the meeting" onBack={backToDashboard} />;

    case "room":
      if (!participant) return null;
      return (
        <Room
          meeting={meeting}
          participant={participant}
          media={media}
          onLeft={async () => {
            try {
              await api.leaveMeeting(code, participant.id);
            } catch {
              // leaving must always succeed locally
            }
            media.stop();
            setStage("left");
          }}
          onEnded={() => {
            media.stop();
            setStage("ended");
          }}
          onRemoved={() => {
            media.stop();
            setStage("removed");
          }}
        />
      );
  }
}
