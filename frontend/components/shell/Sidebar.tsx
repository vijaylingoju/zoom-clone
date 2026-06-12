"use client";

import {
  Ellipsis,
  House,
  MessagesSquare,
  Settings,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
] as const;

function tabClasses(active: boolean): string {
  return `flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition ${
    active ? "bg-black/5 font-medium text-ink" : "text-ink-soft hover:bg-black/5"
  }`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="flex w-21 shrink-0 flex-col items-center justify-between bg-white py-2">
      <div className="flex flex-col items-center gap-1">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={tabClasses(pathname === href)}>
            <Icon size={20} strokeWidth={1.7} />
            {label}
          </Link>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={tabClasses(false)}
          >
            <Ellipsis size={20} strokeWidth={1.7} />
            More
          </button>
          {moreOpen && (
            <div className="absolute left-16 top-0 z-40 w-44 rounded-xl border border-black/10 bg-white p-2 shadow-xl">
              {["Docs", "Whiteboards", "Notes", "Apps"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  title="Not available in this demo"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-black/5"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label="Settings"
        title="Not available in this demo"
        className="rounded-lg p-2 text-ink-soft hover:bg-black/5"
      >
        <Settings size={20} strokeWidth={1.7} />
      </button>
    </nav>
  );
}
