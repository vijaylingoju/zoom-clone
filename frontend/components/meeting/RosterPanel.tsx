"use client";

import { Check, Link2, Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { useState } from "react";

interface RosterEntry {
  id: string;
  name: string;
  role: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised?: boolean;
  isSelf?: boolean;
}

interface RosterPanelProps {
  entries: RosterEntry[];
  inviteUrl: string;
  isHost: boolean;
  onMuteAll: () => void;
  onRemove: (participantId: string) => void;
  onClose: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function RosterPanel({
  entries,
  inviteUrl,
  isHost,
  onMuteAll,
  onRemove,
  onClose,
}: RosterPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">
          Participants ({entries.length})
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close participants panel"
          className="rounded p-1 text-white/60 hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto px-2 py-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zoom-blue text-xs font-semibold text-white">
              {initials(entry.name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-white">
              {entry.name}
              {entry.isSelf && <span className="text-white/50"> (You)</span>}
              {entry.role === "host" && (
                <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                  Host
                </span>
              )}
            </span>
            {isHost && !entry.isSelf && (
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                className="hidden rounded border border-red-400/40 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-400/10 group-hover:block"
              >
                Remove
              </button>
            )}
            <span className="flex items-center gap-2 text-white/60">
              {entry.handRaised && <span className="text-sm">✋</span>}
              {entry.audioEnabled ? <Mic size={14} /> : <MicOff size={14} className="text-red-400" />}
              {entry.videoEnabled ? <Video size={14} /> : <VideoOff size={14} className="text-red-400" />}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={copyInvite}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zoom-blue py-2 text-sm font-medium text-white transition hover:bg-zoom-blue-hover"
        >
          {copied ? <Check size={15} /> : <Link2 size={15} />}
          {copied ? "Copied" : "Invite"}
        </button>
        {isHost && (
          <button
            type="button"
            onClick={onMuteAll}
            className="flex-1 rounded-lg border border-white/20 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Mute All
          </button>
        )}
      </div>
    </div>
  );
}
