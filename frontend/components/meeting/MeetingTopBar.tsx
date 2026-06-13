"use client";

import { Check, Copy, PictureInPicture2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { ZoomWordmark } from "@/components/auth/ZoomWordmark";
import { ViewMenu, type ViewMode } from "@/components/meeting/ViewMenu";
import { formatPmi } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface MeetingTopBarProps {
  meeting: Meeting;
  displayName: string;
  visible: boolean;
  viewMode: ViewMode;
  hideSelf: boolean;
  onViewMode: (mode: ViewMode) => void;
  onToggleHideSelf: () => void;
  onPopOut?: () => void;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1 text-xs">
      <span className="text-white/50">{label}</span>
      <span className="min-w-0 break-words text-white/90">{children}</span>
    </div>
  );
}

const iconBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white";

export function MeetingTopBar({
  meeting,
  displayName,
  visible,
  viewMode,
  hideSelf,
  onViewMode,
  onToggleHideSelf,
  onPopOut,
}: MeetingTopBarProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(meeting.join_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <header
      className={`absolute inset-x-0 top-0 z-30 flex h-9 items-center justify-between bg-black px-3 transition-opacity duration-300 sm:h-10 sm:px-4 ${
        visible || infoOpen ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Left — zoom Workplace (white, like Zoom in-meeting header) */}
      <div className="flex min-w-0 items-center gap-1.5">
        <ZoomWordmark size="xs" className="!text-white" />
        <span className="truncate text-[11px] font-normal leading-none text-white/90 sm:text-xs">
          Workplace
        </span>
      </div>

      {/* Right — evenly sized controls */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <div className="relative">
          <button
            type="button"
            aria-label="Meeting security"
            onClick={() => setInfoOpen((open) => !open)}
            className={`${iconBtn} ${infoOpen ? "bg-white/10 text-emerald-400" : "text-emerald-400/90"}`}
          >
            <ShieldCheck size={15} strokeWidth={2} />
          </button>
          {infoOpen && (
            <div className="absolute right-0 top-9 w-80 rounded-xl border border-white/10 bg-[#111] p-4 shadow-2xl">
              <p className="mb-2 truncate text-sm font-semibold text-white">{meeting.title}</p>
              <InfoRow label="Meeting ID">{formatPmi(meeting.meeting_code)}</InfoRow>
              <InfoRow label="Host">{meeting.host_name}</InfoRow>
              {meeting.passcode && <InfoRow label="Passcode">{meeting.passcode}</InfoRow>}
              <InfoRow label="Invite Link">
                <span className="block truncate">{meeting.join_url}</span>
                <button
                  type="button"
                  onClick={() => void copyLink()}
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

        <ViewMenu
          variant="header"
          mode={viewMode}
          hideSelf={hideSelf}
          onMode={onViewMode}
          onToggleHideSelf={onToggleHideSelf}
        />

        {onPopOut && (
          <button
            type="button"
            onClick={onPopOut}
            className={iconBtn}
            aria-label="Pop out meeting"
            title="Pop out meeting"
          >
            <PictureInPicture2 size={15} />
          </button>
        )}

        <div
          className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3a3a3a] text-[9px] font-bold lowercase text-white"
          title={displayName}
        >
          zm
        </div>
      </div>
    </header>
  );
}
