"use client";

import { useMutation } from "@tanstack/react-query";
import { CalendarPlus, MonitorUp, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";

interface TileProps {
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  color: "orange" | "blue";
  onClick?: () => void;
  disabled?: boolean;
}

function Tile({ label, sublabel, icon, color, onClick, disabled }: TileProps) {
  const base =
    color === "orange"
      ? "bg-zoom-orange hover:bg-zoom-orange-hover"
      : "bg-zoom-blue hover:bg-zoom-blue-hover";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-start gap-3 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm transition group-active:scale-95 sm:h-20 sm:w-20 ${base}`}
      >
        {icon}
      </span>
      <span className="text-left">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {sublabel && <span className="block text-xs text-ink-soft">{sublabel}</span>}
      </span>
    </button>
  );
}

export function ActionTiles({ onSchedule }: { onSchedule: () => void }) {
  const router = useRouter();
  const newMeeting = useMutation({
    mutationFn: api.createInstantMeeting,
    onSuccess: (meeting) => router.push(`/meeting/${meeting.meeting_code}`),
  });

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Tile
          label="New Meeting"
          sublabel={newMeeting.isPending ? "Starting…" : "Start an instant meeting"}
          icon={<Video size={32} />}
          color="orange"
          onClick={() => newMeeting.mutate()}
          disabled={newMeeting.isPending}
        />
        <Tile
          label="Join"
          sublabel="Via meeting ID or link"
          icon={<Plus size={32} />}
          color="blue"
          onClick={() => router.push("/join")}
        />
        <Tile
          label="Schedule"
          sublabel="Plan a meeting"
          icon={<CalendarPlus size={32} />}
          color="blue"
          onClick={onSchedule}
        />
        <Tile
          label="Share Screen"
          sublabel="Coming soon"
          icon={<MonitorUp size={32} />}
          color="blue"
          disabled
        />
      </div>
      {newMeeting.isError && (
        <p className="mt-3 text-sm text-red-600">
          Could not start the meeting. Is the backend running?
        </p>
      )}
    </div>
  );
}
