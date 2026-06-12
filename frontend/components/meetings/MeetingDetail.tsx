"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, hostKeyFor, rememberHostKey } from "@/lib/api";
import { formatMeetingWindow, formatPmi } from "@/lib/format";
import type { Meeting, MeetingCreated } from "@/lib/types";

function invitationText(meeting: Meeting): string {
  const lines = [
    `${meeting.host_name} is inviting you to a Zoom meeting.`,
    "",
    `Topic: ${meeting.title}`,
  ];
  if (meeting.scheduled_start) {
    lines.push(
      `Time: ${formatMeetingWindow(meeting.scheduled_start, meeting.duration_minutes)}`,
    );
  }
  lines.push("", "Join Zoom Meeting", meeting.join_url, "");
  lines.push(`Meeting ID: ${formatPmi(meeting.meeting_code)}`);
  if (meeting.passcode) lines.push(`Passcode: ${meeting.passcode}`);
  return lines.join("\n");
}

export function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const hostKey = hostKeyFor(meeting.meeting_code);

  const start = useMutation({
    mutationFn: async () => {
      if (meeting.is_pmi) return api.createInstantMeeting(true);
      if (hostKey) return api.startMeeting(meeting.meeting_code, hostKey);
      return meeting;
    },
    onSuccess: (started) => {
      if ("host_key" in started) rememberHostKey(started as MeetingCreated);
      router.push(`/meeting/${meeting.meeting_code}`);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteMeeting(meeting.meeting_code, hostKey ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  async function copyInvitation() {
    await navigator.clipboard.writeText(invitationText(meeting));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isPrevious = meeting.status === "ended";

  return (
    <div className="px-10 py-8">
      <h1 className="text-2xl font-bold">
        {meeting.is_pmi ? "My Personal Meeting ID (PMI)" : meeting.title}
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        {formatPmi(meeting.meeting_code)}
        {meeting.scheduled_start && (
          <span className="ml-3">
            {formatMeetingWindow(meeting.scheduled_start, meeting.duration_minutes)}
          </span>
        )}
      </p>
      {meeting.passcode && (
        <p className="mt-1 text-sm text-ink-soft">Passcode: {meeting.passcode}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {!isPrevious && (
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="rounded-lg bg-zoom-blue px-5 py-2 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-50"
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={copyInvitation}
          className="flex items-center gap-1.5 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5"
        >
          {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          Copy Invitation
        </button>
        {!meeting.is_pmi && !isPrevious && (
          <>
            <button
              type="button"
              title="Not available in this demo"
              className="flex items-center gap-1.5 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/5"
            >
              <Pencil size={15} />
              Edit
            </button>
            {hostKey && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
                Delete
              </button>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setInvitationOpen((open) => !open)}
        className="mt-8 text-sm font-medium text-zoom-blue hover:underline"
      >
        {invitationOpen ? "Hide Meeting Invitation" : "Show Meeting Invitation"}
      </button>
      {invitationOpen && (
        <pre className="mt-3 max-w-xl whitespace-pre-wrap rounded-xl border border-black/10 bg-surface p-4 text-xs leading-relaxed">
          {invitationText(meeting)}
        </pre>
      )}
    </div>
  );
}
