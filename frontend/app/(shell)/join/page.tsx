"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { parseMeetingCode } from "@/lib/format";

export default function JoinPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setChecking(true);
    const code = parseMeetingCode(input);
    try {
      const meeting = await api.validateMeeting(code);
      if (meeting.status === "cancelled") {
        setError("This meeting has been cancelled.");
        return;
      }
      router.push(`/meeting/${code}`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Meeting not found. Check the meeting ID and try again."
          : "Could not validate the meeting. Please try again.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md -translate-y-12">
        <h1 className="mb-6 text-2xl font-bold">Join Meeting</h1>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Meeting ID or Personal Link Name"
          aria-label="Meeting ID or Personal Link Name"
          className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!input.trim() || checking}
            className="rounded-lg bg-zoom-blue px-5 py-2 text-sm font-medium text-white transition hover:bg-zoom-blue-hover disabled:opacity-40"
          >
            {checking ? "Checking…" : "Join"}
          </button>
        </div>
      </form>
    </div>
  );
}
