"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use } from "react";

import { api, ApiError } from "@/lib/api";

/**
 * Meeting room shell. Step 4 adds the getUserMedia lobby here; Step 5 adds
 * signaling + WebRTC. For now it validates the code and shows meeting info.
 */
export default function MeetingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const { data: meeting, error, isLoading } = useQuery({
    queryKey: ["meeting", code],
    queryFn: () => api.validateMeeting(code),
    retry: false,
  });

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-room-bg px-4 text-white">
      {isLoading && <p className="text-white/70">Loading meeting…</p>}

      {notFound && (
        <div className="text-center">
          <h1 className="text-xl font-semibold">Meeting not found</h1>
          <p className="mt-2 text-sm text-white/60">
            The meeting ID <code className="text-white/90">{code}</code> does not exist.
          </p>
        </div>
      )}

      {meeting && (
        <div className="w-full max-w-md rounded-2xl bg-room-panel p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold">{meeting.title}</h1>
          <p className="mt-1 text-sm text-white/60">Meeting ID: {meeting.meeting_code}</p>
          <p className="mt-6 text-sm text-white/70">
            {meeting.status === "ended" || meeting.status === "cancelled"
              ? `This meeting has ${meeting.status}.`
              : "The video room is under construction — the lobby and live video arrive in the next steps."}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-8 rounded-lg bg-[#E02828] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#c52222]"
      >
        Back to dashboard
      </button>
    </div>
  );
}
