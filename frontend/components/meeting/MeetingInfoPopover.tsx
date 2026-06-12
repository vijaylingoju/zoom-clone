"use client";

import { Check, Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { formatPmi } from "@/lib/format";
import type { Meeting } from "@/lib/types";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1 text-xs">
      <span className="text-white/50">{label}</span>
      <span className="min-w-0 break-words text-white/90">{children}</span>
    </div>
  );
}

export function MeetingInfoPopover({ meeting, visible }: { meeting: Meeting; visible: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(meeting.join_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className={`absolute left-3 top-3 z-20 transition-opacity duration-300 ${
        visible || open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Meeting information"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-green-400 hover:bg-black/70"
      >
        <ShieldCheck size={17} />
      </button>

      {open && (
        <div className="mt-2 w-80 rounded-xl border border-white/10 bg-[#111] p-4 shadow-2xl">
          <p className="mb-2 truncate text-sm font-semibold text-white">{meeting.title}</p>
          <InfoRow label="Meeting ID">{formatPmi(meeting.meeting_code)}</InfoRow>
          <InfoRow label="Host">{meeting.host_name}</InfoRow>
          {meeting.passcode && <InfoRow label="Passcode">{meeting.passcode}</InfoRow>}
          <InfoRow label="Invite Link">
            <span className="block truncate">{meeting.join_url}</span>
            <button
              type="button"
              onClick={copyLink}
              className="mt-1 inline-flex items-center gap-1 text-zoom-blue hover:underline"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy Link"}
            </button>
          </InfoRow>
          <InfoRow label="Encryption">Enabled (DTLS-SRTP)</InfoRow>
        </div>
      )}
    </div>
  );
}
