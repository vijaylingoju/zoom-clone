import { MessagesSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <MessagesSquare size={40} className="text-ink-soft/50" strokeWidth={1.2} />
      <p className="text-sm font-medium">Team Chat is not part of this demo</p>
      <p className="max-w-xs text-xs text-ink-soft">
        In-meeting chat is available inside every meeting room via the Chat button.
      </p>
    </div>
  );
}
