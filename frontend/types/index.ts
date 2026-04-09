export interface User {
  id: string;
  username: string;
  is_superuser: boolean;
}

export interface PendingUser {
  id: string;
  username: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  room_key?: string;
  created_by: string;
  created_at: string;
}

export interface Event {
  id: string;
  room_id: string;
  created_by: string;
  creator_name: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  created_at: string;
  responses: Response[];
}

export interface Response {
  id: string;
  event_id: string;
  user_id: string;
  username: string;
  response_type: "yes" | "no" | "alternative";
  alt_start_time?: string;
  alt_end_time?: string;
  note: string;
  vote_count: number;
  my_vote: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  room_id: string;
  room_name: string;
  resource_id?: string;
  read: boolean;
  created_at: string;
}

export interface RoomMember {
  user_id: string;
  username: string;
  is_superuser: boolean;
  status: string;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export type WSMessage =
  | { type: "event_created"; room_id: string; payload: Event }
  | { type: "event_deleted"; room_id: string; payload: { event_id: string } }
  | { type: "response_updated"; room_id: string; payload: Response }
  | { type: "chat_message"; room_id: string; payload: ChatMessage }
  | { type: "alternative_voted"; room_id: string; payload: { response_id: string; vote_count: number; voter_id: string; voted: boolean } }
  | { type: "member_approved"; room_id: string; payload: { user_id: string; username: string } }
  | { type: "member_removed"; room_id: string; payload: { user_id: string } }
  | { type: "member_requested"; room_id: string; payload: { user_id: string; username: string } };
