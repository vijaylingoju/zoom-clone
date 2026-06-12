"use client";

import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Navbar() {
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: api.me });

  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-2xl font-bold lowercase tracking-tight text-zoom-blue">
          zoom
        </Link>
        <nav className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Settings"
            className="rounded-full p-2 text-ink-soft transition hover:bg-black/5"
          >
            <Settings size={20} />
          </button>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zoom-blue text-sm font-semibold text-white"
            title={user?.name ?? "Profile"}
          >
            {user ? initials(user.name) : "··"}
          </div>
        </nav>
      </div>
    </header>
  );
}
