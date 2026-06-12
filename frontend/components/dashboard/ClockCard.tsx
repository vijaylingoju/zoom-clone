"use client";

import { useEffect, useState } from "react";

export function ClockCard() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-zoom-blue to-[#0a4fa8] p-6 text-white shadow-sm">
      <p className="text-4xl font-semibold tabular-nums">
        {now
          ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "--:--"}
      </p>
      <p className="mt-1 text-sm text-white/80">
        {now
          ? now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : ""}
      </p>
    </div>
  );
}
