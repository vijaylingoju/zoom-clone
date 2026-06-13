import { getBackendUrl, getRestApiBase } from "./backendUrl";
import type {
  ChatMessage,
  JoinResponse,
  Meeting,
  MeetingCreated,
  ScheduleMeetingInput,
  User,
} from "./types";

const HOST_KEY_PREFIX = "zc_host_key_";

export function rememberHostKey(meeting: MeetingCreated): void {
  localStorage.setItem(HOST_KEY_PREFIX + meeting.meeting_code, meeting.host_key);
}

export function hostKeyFor(code: string): string | null {
  return localStorage.getItem(HOST_KEY_PREFIX + code);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = typeof window !== "undefined" ? getRestApiBase() : getBackendUrl();
  const res = await fetch(`${base}/api${path}`, {
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
  createInstantMeeting: (usePmi = false) =>
    request<MeetingCreated>("/meetings", {
      method: "POST",
      body: JSON.stringify({ meeting_type: "instant", use_pmi: usePmi }),
    }),
  startMeeting: (code: string, hostKey: string) =>
    request<MeetingCreated>(`/meetings/${code}/start`, {
      method: "POST",
      body: JSON.stringify({ host_key: hostKey }),
    }),
  deleteMeeting: (code: string, hostKey: string) =>
    request<void>(`/meetings/${code}`, {
      method: "DELETE",
      body: JSON.stringify({ host_key: hostKey }),
    }),
  scheduleMeeting: (input: ScheduleMeetingInput) =>
    request<MeetingCreated>("/meetings", {
      method: "POST",
      body: JSON.stringify({ ...input, meeting_type: "scheduled" }),
    }),
  joinMeeting: (
    code: string,
    displayName: string,
    hostKey?: string | null,
    passcode?: string | null,
  ) =>
    request<JoinResponse>(`/meetings/${code}/join`, {
      method: "POST",
      body: JSON.stringify({
        display_name: displayName,
        host_key: hostKey ?? null,
        passcode: passcode ?? null,
      }),
    }),
  chatHistory: (code: string) => request<ChatMessage[]>(`/meetings/${code}/chat`),
  leaveMeeting: (code: string, participantId: string) =>
    request<void>(`/meetings/${code}/leave`, {
      method: "POST",
      body: JSON.stringify({ participant_id: participantId }),
    }),
};
