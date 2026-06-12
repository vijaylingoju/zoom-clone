import type {
  JoinResponse,
  Meeting,
  ScheduleMeetingInput,
  User,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  me: () => request<User>("/me"),
  upcomingMeetings: () => request<Meeting[]>("/meetings/upcoming"),
  recentMeetings: () => request<Meeting[]>("/meetings/recent"),
  validateMeeting: (code: string) => request<Meeting>(`/meetings/${code}`),
  createInstantMeeting: () =>
    request<Meeting>("/meetings", {
      method: "POST",
      body: JSON.stringify({ meeting_type: "instant" }),
    }),
  scheduleMeeting: (input: ScheduleMeetingInput) =>
    request<Meeting>("/meetings", {
      method: "POST",
      body: JSON.stringify({ ...input, meeting_type: "scheduled" }),
    }),
  joinMeeting: (code: string, displayName: string) =>
    request<JoinResponse>(`/meetings/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ display_name: displayName }),
    }),
  leaveMeeting: (code: string, participantId: string) =>
    request<void>(`/meetings/${code}/leave`, {
      method: "POST",
      body: JSON.stringify({ participant_id: participantId }),
    }),
};
