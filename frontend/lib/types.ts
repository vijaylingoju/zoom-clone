export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "active" | "ended" | "cancelled";
export type ParticipantRole = "host" | "cohost" | "participant";

export interface User {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  is_guest: boolean;
}

export interface Meeting {
  id: string;
  meeting_code: string;
  title: string;
  description: string | null;
  meeting_type: MeetingType;
  status: MeetingStatus;
  host_id: string;
  host_name: string;
  scheduled_start: string | null;
  duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  join_url: string;
}

export interface Participant {
  id: string;
  display_name: string;
  role: ParticipantRole;
  is_muted: boolean;
  is_video_off: boolean;
  joined_at: string;
}

export interface JoinResponse {
  participant: Participant;
  meeting: Meeting;
}

export interface ScheduleMeetingInput {
  title: string;
  description?: string;
  scheduled_start: string;
  duration_minutes: number;
}
