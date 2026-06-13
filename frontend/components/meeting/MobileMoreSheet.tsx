"use client";

import {
  BarChart3,
  Captions,
  Hand,
  Headphones,
  HelpCircle,
  MessageSquare,
  MonitorUp,
  Settings,
  Users,
} from "lucide-react";

interface MobileMoreSheetProps {
  handRaised: boolean;
  sharing: boolean;
  unreadMessages?: number;
  onToggleHand: () => void;
  onOpenParticipants: () => void;
  onOpenChat: () => void;
  onToggleShare: () => void;
  onClose: () => void;
}

export function MobileMoreSheet({
  handRaised,
  sharing,
  unreadMessages = 0,
  onToggleHand,
  onOpenParticipants,
  onOpenChat,
  onToggleShare,
  onClose,
}: MobileMoreSheetProps) {
  const row =
    "flex w-full items-center justify-between border-b border-white/10 px-5 py-4 text-left text-base text-white";
  const stub = `${row} text-white/40`;

  return (
    <div
      id="mobile-more-sheet"
      className="fixed inset-0 z-[75] flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl bg-[#1f1f1f] pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>

        <button
          type="button"
          className={row}
          onPointerUp={(e) => {
            e.stopPropagation();
            onToggleHand();
            onClose();
          }}
        >
          <span>{handRaised ? "Lower Hand" : "Raise Hand"}</span>
          <Hand size={20} />
        </button>
        <button
          type="button"
          className={row}
          onPointerUp={(e) => {
            e.stopPropagation();
            onOpenParticipants();
            onClose();
          }}
        >
          <span>Participants</span>
          <Users size={20} />
        </button>
        <button
          type="button"
          className={row}
          onPointerUp={(e) => {
            e.stopPropagation();
            onOpenChat();
            onClose();
          }}
        >
          <span>Chat</span>
          <span className="flex items-center gap-2">
            {unreadMessages > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
            <MessageSquare size={20} />
          </span>
        </button>
        <button
          type="button"
          className={`${row} ${sharing ? "text-red-400" : "text-[#23D959]"}`}
          onPointerUp={(e) => {
            e.stopPropagation();
            onToggleShare();
            onClose();
          }}
        >
          <span>{sharing ? "Stop Sharing" : "Share Screen"}</span>
          <MonitorUp size={20} />
        </button>
        <button type="button" className={stub} title="Not available in this demo">
          <span>Show Captions</span>
          <Captions size={20} />
        </button>
        <button type="button" className={stub} title="Not available in this demo">
          <span>Meeting Settings</span>
          <Settings size={20} />
        </button>
        <button type="button" className={stub} title="Not available in this demo">
          <span>Video Statistics</span>
          <BarChart3 size={20} />
        </button>
        <button type="button" className={stub} title="Not available in this demo">
          <span>Help</span>
          <HelpCircle size={20} />
        </button>
        <button type="button" className={`${row} text-red-400`} title="Not available in this demo">
          <span>Disconnect Audio</span>
          <Headphones size={20} />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mx-5 mt-4 w-[calc(100%-2.5rem)] rounded-full border border-white/20 py-3 text-center text-base text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
