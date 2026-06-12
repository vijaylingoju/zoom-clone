"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { formatMeetingWindow, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

function CopyLinkButton({ meeting }: { meeting: Meeting }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(meeting.join_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy invite link"
      className="rounded-lg p-2 text-ink-soft transition hover:bg-black/5"
    >
      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-ink-soft">{message}</p>;
}

export function UpcomingMeetings() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: api.upcomingMeetings,
  });

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">Upcoming meetings</h2>
      {isLoading && <EmptyState message="Loading…" />}
      {data?.length === 0 && <EmptyState message="No upcoming meetings today" />}
      <ul className="divide-y divide-black/5">
        {data?.map((meeting) => (
          <li key={meeting.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-ink-soft">
                {meeting.scheduled_start &&
                  formatMeetingWindow(meeting.scheduled_start, meeting.duration_minutes)}
              </p>
              <p className="text-xs text-ink-soft">ID: {meeting.meeting_code}</p>
            </div>
            <CopyLinkButton meeting={meeting} />
            <button
              type="button"
              onClick={() => router.push(`/meeting/${meeting.meeting_code}`)}
              className="rounded-lg bg-zoom-blue px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zoom-blue-hover"
            >
              Start
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RecentMeetings() {
  const { data, isLoading } = useQuery({
    queryKey: ["meetings", "recent"],
    queryFn: api.recentMeetings,
  });

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">Recent meetings</h2>
      {isLoading && <EmptyState message="Loading…" />}
      {data?.length === 0 && <EmptyState message="No meetings yet" />}
      <ul className="divide-y divide-black/5">
        {data?.map((meeting) => (
          <li key={meeting.id} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft">
              <Video size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-ink-soft">
                {meeting.ended_at && `Ended ${formatTime(meeting.ended_at)}`}
                {meeting.duration_minutes ? ` · ${meeting.duration_minutes} min` : ""}
              </p>
            </div>
            <span className="text-xs text-ink-soft">ID: {meeting.meeting_code}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
