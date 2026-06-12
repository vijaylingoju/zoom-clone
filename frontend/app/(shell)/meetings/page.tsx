"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { MeetingDetail } from "@/components/meetings/MeetingDetail";
import { api } from "@/lib/api";
import { formatMeetingWindow, formatPmi, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type ListTab = "upcoming" | "previous";

function ListItem({
  meeting,
  selected,
  onSelect,
}: {
  meeting: Meeting;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl px-4 py-3 text-left transition ${
        selected ? "bg-zoom-blue text-white" : "hover:bg-black/5"
      }`}
    >
      <p className="truncate text-sm font-medium">{meeting.title}</p>
      <p className={`text-xs ${selected ? "text-white/80" : "text-ink-soft"}`}>
        {meeting.scheduled_start
          ? formatMeetingWindow(meeting.scheduled_start, meeting.duration_minutes)
          : meeting.ended_at
            ? `Ended ${formatTime(meeting.ended_at)}`
            : formatPmi(meeting.meeting_code)}
      </p>
    </button>
  );
}

export default function MeetingsPage() {
  const [tab, setTab] = useState<ListTab>("upcoming");
  // window.location, not useSearchParams: avoids the Suspense requirement
  const [selectedCode, setSelectedCode] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("selected"),
  );

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: upcoming, refetch: refetchUpcoming } = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: api.upcomingMeetings,
  });
  const { data: previous, refetch: refetchPrevious } = useQuery({
    queryKey: ["meetings", "previous"],
    queryFn: api.recentMeetings,
  });
  const { data: pmiMeeting } = useQuery({
    queryKey: ["meeting", user?.pmi_code],
    queryFn: () => api.validateMeeting(user!.pmi_code!),
    enabled: !!user?.pmi_code,
  });

  const list = (tab === "upcoming" ? upcoming : previous) ?? [];
  const selected: Meeting | null =
    list.find((m) => m.meeting_code === selectedCode) ??
    (selectedCode && pmiMeeting?.meeting_code === selectedCode ? pmiMeeting : null) ??
    pmiMeeting ??
    null;

  return (
    <div className="flex h-full">
      <aside className="flex w-80 shrink-0 flex-col border-r border-black/10 bg-surface/50">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => {
              refetchUpcoming();
              refetchPrevious();
            }}
            className="rounded p-1.5 text-ink-soft hover:bg-black/5"
          >
            <RefreshCw size={15} />
          </button>
          <div className="flex flex-1 justify-center gap-1 rounded-lg bg-white p-1 text-sm shadow-sm">
            {(["upcoming", "previous"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 rounded-md px-3 py-1 capitalize transition ${
                  tab === value ? "font-semibold text-zoom-blue" : "text-ink-soft"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {user?.pmi_code && pmiMeeting && (
          <button
            type="button"
            onClick={() => setSelectedCode(pmiMeeting.meeting_code)}
            className={`mx-3 mb-2 rounded-2xl px-4 py-4 text-left transition ${
              selected?.meeting_code === pmiMeeting.meeting_code
                ? "bg-zoom-blue text-white"
                : "bg-white shadow-sm hover:bg-black/5"
            }`}
          >
            <p className="text-lg font-semibold">{formatPmi(user.pmi_code)}</p>
            <p
              className={`text-xs ${
                selected?.meeting_code === pmiMeeting.meeting_code
                  ? "text-white/80"
                  : "text-ink-soft"
              }`}
            >
              My Personal Meeting ID (PMI)
            </p>
          </button>
        )}

        <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {list.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-soft">
              No {tab} meetings
            </p>
          ) : (
            list.map((meeting) => (
              <ListItem
                key={meeting.id}
                meeting={meeting}
                selected={selected?.meeting_code === meeting.meeting_code}
                onSelect={() => setSelectedCode(meeting.meeting_code)}
              />
            ))
          )}
        </div>

        <button
          type="button"
          title="Not available in this demo"
          className="border-t border-black/5 py-3 text-center text-xs text-ink-soft hover:bg-black/5"
        >
          📅 Add a calendar
        </button>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <MeetingDetail meeting={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-soft">
            Select a meeting to see its details
          </div>
        )}
      </section>
    </div>
  );
}
