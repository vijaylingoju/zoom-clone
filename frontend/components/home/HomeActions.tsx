"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronDown, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api, rememberHostKey } from "@/lib/api";
import { formatPmi } from "@/lib/format";

interface ActionProps {
  label: string;
  color: "orange" | "blue";
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  chevron?: React.ReactNode;
}

function Action({ label, color, icon, onClick, disabled, chevron }: ActionProps) {
  const bg =
    color === "orange"
      ? "bg-zoom-orange group-hover:bg-zoom-orange-hover"
      : "bg-zoom-blue group-hover:bg-zoom-blue-hover";
  return (
    <div className="group flex flex-col items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)] active:scale-95 disabled:opacity-50 disabled:group-hover:translate-y-0 disabled:group-hover:shadow-sm ${bg}`}
        >
          {icon}
        </button>
        {chevron}
      </div>
      <span className="flex items-center text-sm text-[#6e7680]">{label}</span>
    </div>
  );
}

export function HomeActions() {
  const router = useRouter();
  const [usePmi, setUsePmi] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const newMeeting = useMutation({
    mutationFn: () => api.createInstantMeeting(usePmi),
    onSuccess: (meeting) => {
      rememberHostKey(meeting);
      router.push(`/meeting/${meeting.meeting_code}`);
    },
  });

  return (
    <div className="flex items-start justify-center gap-6 sm:gap-10">
      <div className="relative" ref={menuRef}>
        <Action
          label="New meeting"
          color="orange"
          icon={<Video size={28} />}
          onClick={() => newMeeting.mutate()}
          disabled={newMeeting.isPending}
          chevron={
            <button
              type="button"
              aria-label="New meeting options"
              onClick={() => setMenuOpen((open) => !open)}
              className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-ink-soft shadow-sm hover:bg-black/5"
            >
              <ChevronDown size={14} />
            </button>
          }
        />
        {menuOpen && (
          <div className="absolute left-1/2 top-20 z-30 w-72 -translate-x-1/2 rounded-xl border border-black/10 bg-white p-2 shadow-xl">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5">
              <input
                type="checkbox"
                checked={usePmi}
                onChange={(e) => setUsePmi(e.target.checked)}
                className="accent-zoom-blue"
              />
              <span>
                Use my Personal Meeting ID (PMI)
                {user?.pmi_code && (
                  <span className="block text-xs text-ink-soft">
                    {formatPmi(user.pmi_code)}
                  </span>
                )}
              </span>
            </label>
          </div>
        )}
      </div>
      <Action
        label="Join"
        color="blue"
        icon={<Plus size={28} />}
        onClick={() => router.push("/join")}
      />
      <Action
        label="Schedule"
        color="blue"
        icon={<CalendarPlus size={28} />}
        onClick={() => router.push("/schedule")}
      />
    </div>
  );
}
