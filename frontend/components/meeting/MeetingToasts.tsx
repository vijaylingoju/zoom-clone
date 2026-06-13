"use client";

import { MessageSquare, UserPlus, X } from "lucide-react";

import type { MeetingToast } from "@/hooks/useMeetingConnection";

interface MeetingToastsProps {
  toasts: MeetingToast[];
  onDismiss: (id: string) => void;
  onOpenChat: () => void;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function MeetingToasts({ toasts, onDismiss, onOpenChat }: MeetingToastsProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.25rem] z-[100] flex flex-col items-center gap-2 px-3 sm:bottom-[5.5rem] sm:items-start sm:px-6">
      {toasts.map((toast) => {
        const isChat = toast.type === "chat";
        const Icon = isChat ? MessageSquare : UserPlus;

        return (
          <div
            key={toast.id}
            className="zc-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-white/10 bg-[#2d2d2d]/95 px-4 py-3 text-left shadow-2xl backdrop-blur-sm"
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isChat ? "bg-zoom-blue/20 text-zoom-blue" : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              <Icon size={16} />
            </div>

            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                if (isChat) onOpenChat();
                onDismiss(toast.id);
              }}
            >
              <p className="text-sm font-semibold text-white">{toast.title}</p>
              {toast.body && (
                <p className="mt-0.5 text-xs leading-relaxed text-white/75">
                  {isChat ? truncate(toast.body, 96) : toast.body}
                </p>
              )}
              {isChat && (
                <p className="mt-1 text-[10px] font-medium text-zoom-blue">Tap to open chat</p>
              )}
            </button>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
