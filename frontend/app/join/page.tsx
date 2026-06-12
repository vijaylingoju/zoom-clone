"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Navbar } from "@/components/dashboard/Navbar";
import { api, ApiError } from "@/lib/api";
import { parseMeetingCode } from "@/lib/format";

export default function JoinPage() {
  const router = useRouter();
  const [idInput, setIdInput] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setValidating(true);
    const code = parseMeetingCode(idInput);
    try {
      const meeting = await api.validateMeeting(code);
      if (meeting.status === "ended" || meeting.status === "cancelled") {
        setError(`This meeting has ${meeting.status}.`);
        return;
      }
      sessionStorage.setItem("zc_display_name", name.trim() || user?.name || "Guest");
      router.push(`/meeting/${code}`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Meeting not found. Check the meeting ID and try again."
          : "Could not validate the meeting. Please try again.",
      );
    } finally {
      setValidating(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20";

  return (
    <>
      <Navbar />
      <main className="flex flex-1 items-start justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-xl font-semibold">Join Meeting</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="join-id" className="mb-1 block text-sm font-medium">
                Meeting ID or invite link
              </label>
              <input
                id="join-id"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                required
                placeholder="abc-defg-hjk"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="join-name" className="mb-1 block text-sm font-medium">
                Your name
              </label>
              <input
                id="join-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={user?.name ?? "Your name"}
                maxLength={50}
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={validating || !idInput.trim()}
              className="w-full rounded-lg bg-zoom-blue py-2.5 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-50"
            >
              {validating ? "Checking…" : "Join"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
