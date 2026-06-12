"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, hostKeyFor, rememberHostKey } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { Meeting, MeetingCreated } from "@/lib/types";

function sameDay(iso: string, day: Date): boolean {
  return new Date(iso).toDateString() === day.toDateString();
}

function dayLabel(day: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const base = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (day.toDateString() === today.toDateString()) return `Today, ${base}`;
  if (day.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${base}`;
  return day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function UmbrellaIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
      <path d="M36 12c-14 0-24 10-26 22h52C60 22 50 12 36 12Z" fill="#C7D2FE" />
      <path d="M36 12c-6 0-11 10-12 22h24c-1-12-6-22-12-22Z" fill="#E0E7FF" />
      <path d="M36 34v22" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 56c0 3 2.5 5 5.5 5" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="36" cy="64" rx="22" ry="3" fill="#F1F5F9" />
    </svg>
  );
}

function AgendaRow({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const start = useMutation({
    mutationFn: () => {
      const key = hostKeyFor(meeting.meeting_code);
      return key
        ? api.startMeeting(meeting.meeting_code, key)
        : Promise.resolve(meeting);
    },
    onSuccess: (started) => {
      if ("host_key" in started) rememberHostKey(started as MeetingCreated);
      router.push(`/meeting/${meeting.meeting_code}`);
    },
  });

  return (
    <div className="group flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-0">
      <div className="w-16 shrink-0 text-xs text-ink-soft">
        {meeting.scheduled_start ? formatTime(meeting.scheduled_start) : "—"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{meeting.title}</p>
        <p className="text-xs text-ink-soft">ID: {meeting.meeting_code}</p>
      </div>
      <button
        type="button"
        onClick={() => start.mutate()}
        className="rounded-lg bg-zoom-blue px-4 py-1.5 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100 hover:bg-zoom-blue-hover"
      >
        Start
      </button>
    </div>
  );
}

export function AgendaCard() {
  const [day, setDay] = useState(() => new Date());
  const { data: upcoming } = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: api.upcomingMeetings,
  });

  const todays = (upcoming ?? []).filter(
    (meeting) => meeting.scheduled_start && sameDay(meeting.scheduled_start, day),
  );

  function shift(days: number) {
    setDay((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-black/10 bg-white">
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-zoom-blue/30 bg-zoom-blue/5 px-4 py-2.5 text-sm">
        <Info size={15} className="shrink-0 text-zoom-blue" />
        <span className="min-w-0 truncate">
          You haven&apos;t connected your calendar yet.{" "}
          <button
            type="button"
            title="Not available in this demo"
            className="font-medium text-zoom-blue hover:underline"
          >
            Connect now
          </button>{" "}
          to manage all your meetings and events in one place.
        </span>
      </div>

      <div className="flex items-center justify-center gap-1 border-b border-black/5 py-2 text-sm font-semibold">
        {dayLabel(day)}
        <ChevronDown size={14} className="text-ink-soft" />
      </div>

      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDay(new Date())}
            className="flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5"
          >
            <Calendar size={12} />
            Today
          </button>
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => shift(-1)}
            className="rounded p-1.5 text-ink-soft hover:bg-black/5"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => shift(1)}
            className="rounded p-1.5 text-ink-soft hover:bg-black/5"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="min-h-72">
        {todays.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3">
            <UmbrellaIllustration />
            <p className="text-sm text-ink-soft">No meetings scheduled.</p>
          </div>
        ) : (
          todays.map((meeting) => <AgendaRow key={meeting.id} meeting={meeting} />)
        )}
      </div>
    </section>
  );
}
