/**
 * API request/response types — mirror FastAPI (Beanie) models.
 * Source of truth: api/src/db/models/user.py and api/src/users/schemas.py
 */

export interface ApiUser {
  id: string;
  auth0_id: string;
  name: string;
  occupation: string;
  gender: string;
  interests: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiUserCreate {
  name: string;
  occupation: string;
  gender: string;
  interests: string[];
}

export interface ApiUserUpdate {
  name?: string;
  occupation?: string;
  gender?: string;
  interests?: string[];
}

export interface ApiCommutePoint {
  name: string;
  lat: number;
  lng: number;
}

export interface ApiTimeWindow {
  start_minute: number;
  end_minute: number;
}

export interface ApiGroupSizePreference {
  min: number;
  max: number;
}

export interface ApiRouteSegment {
  type: 'walk' | 'transit';
  coordinates: [number, number][];
  label?: string | null;
  transit_line?: string | null;
}

export interface ApiCommuteResponse {
  id: string;
  user_auth0_id: string;
  start: ApiCommutePoint;
  end: ApiCommutePoint;
  time_window: ApiTimeWindow;
  transport_mode: 'walk' | 'transit';
  match_preference: 'individual' | 'group';
  group_size_pref: ApiGroupSizePreference;
  gender_preference: 'any' | 'same';
  status: 'queued' | 'paused';
  enable_queue_flow: boolean;
  enable_suggestions_flow: boolean;
  queue_days_of_week: number[];
  route_segments: ApiRouteSegment[];
  route_coordinates: [number, number][];
  created_at: string;
  updated_at: string;
}

export interface ApiCommuteCreate {
  start: ApiCommutePoint;
  end: ApiCommutePoint;
  time_window: ApiTimeWindow;
  transport_mode: 'walk' | 'transit';
  match_preference: 'individual' | 'group';
  group_size_pref: ApiGroupSizePreference;
  gender_preference: 'any' | 'same';
  enable_queue_flow: boolean;
  enable_suggestions_flow: boolean;
  queue_days_of_week: number[];
}

export interface ApiCommutePatch extends Partial<ApiCommuteCreate> {}

export interface ApiDecision {
  auth0_id: string;
  accepted_at: string | null;
  passed_at: string | null;
  pass_cooldown_until: string | null;
}

export interface ApiMatchScores {
  overlap_score: number;
  interest_score: number;
  composite_score: number;
}

export interface ApiMatchPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface ApiMatchParticipantProfile {
  auth0_id: string;
  name: string;
  occupation: string;
  gender: string;
  interests: string[];
}

export interface ApiMatchSuggestion {
  id: string;
  source: 'suggested' | 'queue_assigned';
  kind: 'individual' | 'group';
  status: 'suggested' | 'assigned' | 'active' | 'completed';
  participants: ApiMatchParticipantProfile[];
  participant_auth0_ids: string[];
  transport_mode: 'walk' | 'transit';
  scores: ApiMatchScores;
  compatibility_percent: number;
  shared_segment_start: ApiMatchPoint;
  shared_segment_end: ApiMatchPoint;
  estimated_time_minutes: number;
  decisions: ApiDecision[];
  chat_room_id: string | null;
  commute_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiMatchRunResponse {
  suggestions_individual: number;
  suggestions_group: number;
  assignments_individual: number;
  assignments_group: number;
}

export interface ApiChatMessage {
  id: string;
  chat_room_id: string;
  sender_auth0_id: string | null;
  sender_name: string;
  body: string;
  is_system: boolean;
  created_at: string;
}

export interface ApiChatRoomSummary {
  id: string;
  match_id: string;
  participants: string[];
  type: 'dm' | 'group';
  last_message: string | null;
  last_message_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiChatRoomDetail extends ApiChatRoomSummary {
  messages: ApiChatMessage[];
}
