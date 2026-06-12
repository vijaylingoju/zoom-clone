"use client";

import { useEffect, useState } from "react";

import { AgendaCard } from "@/components/home/AgendaCard";
import { HomeActions } from "@/components/home/HomeActions";

function HomeClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <p className="text-5xl font-semibold tabular-nums tracking-tight">
        {now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "--:--"}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {now
          ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
          : ""}
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 px-4 py-12">
      <HomeClock />
      <HomeActions />
      <AgendaCard />
    </div>
  );
}
