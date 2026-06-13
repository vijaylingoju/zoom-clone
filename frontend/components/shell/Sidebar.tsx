"use client";

import { Ellipsis, House, MessagesSquare, Settings, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="flex shrink-0 items-center border-t border-black/10 bg-white md:w-20 md:flex-col md:items-center md:justify-between md:border-t-0 md:py-2">
      <div className="flex flex-1 items-center justify-around md:flex-none md:flex-col md:gap-1 md:self-stretch">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={tabClasses(pathname === href)}>
            <Icon size={20} strokeWidth={1.7} />
            {label}
          </Link>
        ))}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={tabClasses(false)}
          >
            <Ellipsis size={20} strokeWidth={1.7} />
            More
          </button>
          {moreOpen && (
            <div className="absolute bottom-full left-1/2 z-40 mb-2 w-44 -translate-x-1/2 rounded-xl border border-black/10 bg-white p-2 shadow-xl md:bottom-auto md:left-16 md:top-0 md:translate-x-0">
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
        className="hidden rounded-lg p-2 text-ink-soft hover:bg-black/5 md:block"
      >
        <Settings size={20} strokeWidth={1.7} />
      </button>
    </nav>
  );
}
