"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { clearAuth } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { useMeetingPipOptional } from "@/lib/meetingPipContext";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

function HistoryMenu({ onClose }: { onClose: () => void }) {
  const ref = useClickOutside(onClose);
  const { data: recent } = useQuery({
    queryKey: ["meetings", "previous"],
    queryFn: api.recentMeetings,
  });

  return (
    <div
      ref={ref}
      className="absolute left-0 top-10 z-40 w-72 rounded-xl border border-black/10 bg-white p-2 shadow-xl"
    >
      <p className="px-2 py-1 text-xs font-semibold text-ink-soft">Recent meetings</p>
      {(recent ?? []).slice(0, 5).map((meeting) => (
        <div key={meeting.id} className="rounded-lg px-2 py-1.5 hover:bg-black/5">
          <p className="truncate text-sm">{meeting.title}</p>
          <p className="text-xs text-ink-soft">
            {meeting.ended_at ? `Ended ${formatTime(meeting.ended_at)}` : meeting.meeting_code}
          </p>
        </div>
      ))}
      {recent?.length === 0 && (
        <p className="px-2 py-3 text-center text-xs text-ink-soft">No recent meetings</p>
      )}
    </div>
  );
}

function AvatarMenu({ onClose }: { onClose: () => void }) {
  const ref = useClickOutside(onClose);
  const router = useRouter();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });

  function signOut() {
    clearAuth();
    onClose();
    router.push("/welcome");
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-black/10 bg-white p-2 shadow-xl"
    >
      <div className="border-b border-black/5 px-3 py-2">
        <p className="text-sm font-medium">{user?.name}</p>
        <p className="truncate text-xs text-ink-soft">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        title="Not available in this demo"
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-black/5"
      >
        Settings
      </button>
      <button
        type="button"
        onClick={signOut}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-black/5"
      >
        Sign Out
      </button>
    </div>
  );
}

export function TopBar() {
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const pip = useMeetingPipOptional();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-white px-3 py-2 sm:px-4">
      <div className="flex shrink-0 items-baseline gap-1 leading-none">
        <span className="text-sm font-bold lowercase text-zoom-blue">zoom</span>
        <span className="hidden text-base font-semibold text-ink sm:inline">Workplace</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-2 sm:px-6">
        {pip?.poppedOut && pip.controls && (
          <button
            type="button"
            onClick={() => pip.expand(pip.controls!.meetingCode)}
            className="hidden shrink-0 rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-medium text-zoom-blue hover:bg-[#d6eaff] sm:inline"
          >
            Return to meeting
          </button>
        )}
        <div className="relative hidden items-center gap-1 text-ink-soft sm:flex">
          <span className="rounded p-1 opacity-40">
            <ChevronLeft size={16} />
          </span>
          <span className="rounded p-1 opacity-40">
            <ChevronRight size={16} />
          </span>
          <button
            type="button"
            aria-label="History"
            onClick={() => setHistoryOpen((open) => !open)}
            className="rounded p-1 hover:bg-black/5"
          >
            <History size={16} />
          </button>
          {historyOpen && <HistoryMenu onClose={() => setHistoryOpen(false)} />}
        </div>
        <button
          type="button"
          title="Search is not available in this demo"
          className="flex w-full max-w-md items-center gap-2 rounded-lg bg-[#ECECEC] px-3 py-1.5 text-sm text-ink-soft"
        >
          <Search size={15} />
          <span>
            Search <span className="text-xs">Ctrl+K</span>
          </span>
        </button>
      </div>

      <div className="relative flex shrink-0 items-center gap-3">
        <button
          type="button"
          title="Not available in this demo"
          className="hidden rounded-lg bg-zoom-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-zoom-blue-hover sm:block"
        >
          Upgrade to Pro
        </button>
        <button
          type="button"
          aria-label="Profile menu"
          onClick={() => setAvatarOpen((open) => !open)}
          className="relative"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoom-blue text-xs font-semibold text-white">
            {user ? initials(user.name) : "··"}
          </span>
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
        </button>
        {avatarOpen && <AvatarMenu onClose={() => setAvatarOpen(false)} />}
      </div>
    </header>
  );
}
