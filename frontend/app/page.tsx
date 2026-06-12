"use client";

import { useState } from "react";

import { ActionTiles } from "@/components/dashboard/ActionTiles";
import { ClockCard } from "@/components/dashboard/ClockCard";
import { RecentMeetings, UpcomingMeetings } from "@/components/dashboard/MeetingLists";
import { Navbar } from "@/components/dashboard/Navbar";
import { ScheduleModal } from "@/components/dashboard/ScheduleModal";

export default function DashboardPage() {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <ActionTiles onSchedule={() => setScheduleOpen(true)} />
            </div>
            <RecentMeetings />
          </div>
          <div className="flex flex-col gap-6">
            <ClockCard />
            <UpcomingMeetings />
          </div>
        </div>
      </main>
      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </>
  );
}
