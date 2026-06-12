"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, rememberHostKey } from "@/lib/api";
import { formatPmi } from "@/lib/format";

const PASSCODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomPasscode(): string {
  return Array.from(
    { length: 6 },
    () => PASSCODE_ALPHABET[Math.floor(Math.random() * PASSCODE_ALPHABET.length)],
  ).join("");
}

function defaultWhen(): { date: string; time: string } {
  const next = new Date(Date.now() + 60 * 60_000);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
  };
}

const inputClass =
  "rounded-lg border border-black/20 px-3 py-2 text-sm outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-black/5 py-5 sm:grid-cols-[160px_1fr] sm:gap-6">
      <span className="pt-2 text-sm text-ink-soft">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const defaults = defaultWhen();
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [topic, setTopic] = useState("My Meeting");
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [timezone, setTimezone] = useState(browserTz);
  const [passcodeOn, setPasscodeOn] = useState(true);
  const [passcode, setPasscode] = useState(randomPasscode);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [hostVideo, setHostVideo] = useState(true);
  const [participantVideo, setParticipantVideo] = useState(true);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const timezones = (() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [browserTz, "UTC"];
    }
  })();

  const schedule = useMutation({
    mutationFn: () =>
      api.scheduleMeeting({
        title: topic.trim(),
        description: description.trim() || undefined,
        scheduled_start: new Date(`${date}T${time}`).toISOString(),
        duration_minutes: Math.max(15, hours * 60 + minutes),
        passcode: passcodeOn ? passcode : null,
        timezone,
        host_video_on: hostVideo,
        participant_video_on: participantVideo,
      }),
    onSuccess: (meeting) => {
      rememberHostKey(meeting);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      router.push(`/meetings?selected=${meeting.meeting_code}`);
    },
  });

  const durationInvalid = hours * 60 + minutes < 15;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-bold">Schedule Meeting</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          schedule.mutate();
        }}
      >
        <Row label="Topic">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            maxLength={200}
            aria-label="Topic"
            className={`${inputClass} w-full max-w-md`}
          />
          {!showDescription ? (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="mt-2 block text-sm text-zoom-blue hover:underline"
            >
              + Add Description
            </button>
          ) : (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Meeting description"
              aria-label="Description"
              className={`${inputClass} mt-2 w-full max-w-md`}
            />
          )}
        </Row>

        <Row label="When">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              aria-label="Date"
              className={inputClass}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              aria-label="Time"
              className={inputClass}
            />
          </div>
        </Row>

        <Row label="Duration">
          <div className="flex items-center gap-2 text-sm">
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              aria-label="Duration hours"
              className={inputClass}
            >
              {Array.from({ length: 13 }, (_, h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            hr
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="Duration minutes"
              className={inputClass}
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            min
          </div>
          {durationInvalid && (
            <p className="mt-1 text-xs text-red-600">Minimum duration is 15 minutes.</p>
          )}
        </Row>

        <Row label="Time Zone">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-label="Time Zone"
            className={`${inputClass} w-full max-w-md`}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" disabled title="Not available in this demo" />
            Recurring meeting
          </label>
        </Row>

        <Row label="Meeting ID">
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked readOnly className="accent-zoom-blue" />
              Generate Automatically
            </label>
            <label
              className="flex items-center gap-2 text-ink-soft"
              title="PMI scheduling is not available in this demo"
            >
              <input type="radio" disabled />
              Personal Meeting ID {user?.pmi_code ? formatPmi(user.pmi_code) : ""}
            </label>
          </div>
        </Row>

        <Row label="Security">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <input
                id="passcode-toggle"
                type="checkbox"
                checked={passcodeOn}
                onChange={(e) => setPasscodeOn(e.target.checked)}
                className="accent-zoom-blue"
              />
              <label htmlFor="passcode-toggle">Passcode</label>
              {passcodeOn && (
                <input
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  maxLength={10}
                  required
                  aria-label="Passcode"
                  className={`${inputClass} w-32`}
                />
              )}
            </div>
            <p className="text-xs text-ink-soft">
              Only users who have the invite link or passcode can join the meeting
            </p>
            <div className="flex items-center gap-2">
              <input
                id="waiting-room"
                type="checkbox"
                checked={waitingRoom}
                onChange={(e) => setWaitingRoom(e.target.checked)}
                disabled
                title="Waiting room is not available in this demo"
              />
              <label htmlFor="waiting-room" className="text-ink-soft">
                Waiting Room
              </label>
            </div>
          </div>
        </Row>

        <Row label="Video">
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-10">
            {(
              [
                ["Host", hostVideo, setHostVideo],
                ["Participant", participantVideo, setParticipantVideo],
              ] as const
            ).map(([label, value, setValue]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-ink-soft">{label}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={value}
                    onChange={() => setValue(true)}
                    className="accent-zoom-blue"
                  />
                  on
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={!value}
                    onChange={() => setValue(false)}
                    className="accent-zoom-blue"
                  />
                  off
                </label>
              </div>
            ))}
          </div>
        </Row>

        {schedule.isError && (
          <p className="mt-3 text-sm text-red-600">
            Could not schedule the meeting. Please try again.
          </p>
        )}

        <div className="flex gap-2 py-6">
          <button
            type="submit"
            disabled={schedule.isPending || !topic.trim() || durationInvalid}
            className="rounded-lg bg-zoom-blue px-6 py-2 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-40"
          >
            {schedule.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg border border-black/15 px-6 py-2 text-sm font-medium hover:bg-black/5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
