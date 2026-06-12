"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";

const DURATIONS = [15, 30, 45, 60, 90, 120];

function defaultDateTime(): { date: string; time: string } {
  const next = new Date(Date.now() + 60 * 60_000);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
  };
}

export function ScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const defaults = defaultDateTime();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [duration, setDuration] = useState(30);
  const [created, setCreated] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const schedule = useMutation({
    mutationFn: api.scheduleMeeting,
    onSuccess: (meeting) => {
      setCreated(meeting);
      queryClient.invalidateQueries({ queryKey: ["meetings", "upcoming"] });
    },
  });

  if (!open) return null;

  function close() {
    setCreated(null);
    setTitle("");
    setDescription("");
    schedule.reset();
    onClose();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    schedule.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      scheduled_start: new Date(`${date}T${time}`).toISOString(),
      duration_minutes: duration,
    });
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.join_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20";

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule meeting"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Schedule Meeting</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-soft hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        {created ? (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-medium">{created.title}</span> is scheduled. Share the
              invite link:
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs">{created.join_url}</code>
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copy invite link"
                className="rounded p-1.5 text-ink-soft hover:bg-black/5"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
            <button
              type="button"
              onClick={close}
              className="w-full rounded-lg bg-zoom-blue py-2 text-sm font-medium text-white hover:bg-zoom-blue-hover"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="sched-title" className="mb-1 block text-sm font-medium">
                Topic
              </label>
              <input
                id="sched-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="My meeting"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="sched-desc" className="mb-1 block text-sm font-medium">
                Description <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <textarea
                id="sched-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sched-date" className="mb-1 block text-sm font-medium">
                  Date
                </label>
                <input
                  id="sched-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="sched-time" className="mb-1 block text-sm font-medium">
                  Time
                </label>
                <input
                  id="sched-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="sched-duration" className="mb-1 block text-sm font-medium">
                Duration
              </label>
              <select
                id="sched-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={inputClass}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60
                      ? `${minutes} minutes`
                      : `${minutes / 60} hour${minutes > 60 ? "s" : ""}`}
                  </option>
                ))}
              </select>
            </div>
            {schedule.isError && (
              <p className="text-sm text-red-600">{(schedule.error as Error).message}</p>
            )}
            <button
              type="submit"
              disabled={schedule.isPending || !title.trim()}
              className="w-full rounded-lg bg-zoom-blue py-2 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-50"
            >
              {schedule.isPending ? "Scheduling…" : "Schedule"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
