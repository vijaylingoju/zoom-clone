export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "active" | "ended" | "cancelled";
export type ParticipantRole = "host" | "cohost" | "participant";

export interface User {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  is_guest: boolean;
  pmi_code: string | null;
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
  is_pmi: boolean;
  has_passcode: boolean;
  timezone: string | null;
  scheduled_start: string | null;
  duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  join_url: string;
  /** Present only on owner-facing responses (lists, join, create). */
  passcode?: string | null;
}

export interface Participant {
  id: string;
  display_name: string;
  role: ParticipantRole;
  is_muted: boolean;
  is_video_off: boolean;
  joined_at: string;
}

export interface MeetingCreated extends Meeting {
  host_key: string;
}

export interface JoinResponse {
  participant: Participant;
  meeting: Meeting;
}

export interface ChatMessage {
  id: string;
  participant_id: string;
  display_name: string;
  content: string;
  created_at: string;
}

export interface ScheduleMeetingInput {
  title: string;
  description?: string;
  scheduled_start: string;
  duration_minutes: number;
  use_pmi?: boolean;
  passcode?: string | null;
  timezone?: string;
  host_video_on?: boolean;
  participant_video_on?: boolean;
}
