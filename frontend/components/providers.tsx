"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { MeetingPipLayer } from "@/components/meeting/MeetingPipLayer";
import { MeetingPipProvider } from "@/lib/meetingPipContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MeetingPipProvider>
        {children}
        <MeetingPipLayer />
      </MeetingPipProvider>
    </QueryClientProvider>
  );
}
