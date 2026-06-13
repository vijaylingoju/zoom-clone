"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AgendaCard } from "@/components/home/AgendaCard";
import { DashboardSkeleton } from "@/components/home/DashboardSkeleton";
import { HomeActions } from "@/components/home/HomeActions";
import { api } from "@/lib/api";

function HomeClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-center">
      <p className="text-5xl font-semibold tabular-nums tracking-tight">
        {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}

export default function HomePage() {
  const { isLoading: meLoading } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { isLoading: upcomingLoading } = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: api.upcomingMeetings,
  });

  if (meLoading || upcomingLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-10 px-4 py-12">
      <HomeClock />
      <HomeActions />
      <AgendaCard />
    </div>
  );
}
