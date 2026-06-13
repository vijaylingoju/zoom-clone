"use client";

import { SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  selfParticipantId: string;
  onSend: (content: string) => void;
  onClose: () => void;
}

export function ChatPanel({ messages, selfParticipantId, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 bg-[#1f1f1f]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Meeting Chat</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat panel"
          className="rounded p-1 text-white/60 hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-4 text-center text-xs text-white/40">No messages yet</p>
        )}
        {messages.map((message) => (
          <div key={message.id}>
            <p className="text-xs text-white/50">
              <span className="font-medium text-white/80">
                {message.participant_id === selfParticipantId ? "You" : message.display_name}
              </span>{" "}
              {formatTime(message.created_at)}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-white">
              {message.content}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-white/10 p-3">
        <p className="mb-1.5 text-xs text-white/50">
          To: <span className="rounded bg-zoom-blue/20 px-1.5 py-0.5 text-zoom-blue">Everyone</span>
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type message here…"
            maxLength={2000}
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-zoom-blue"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="rounded-lg p-2 text-zoom-blue transition hover:bg-white/10 disabled:opacity-40"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
