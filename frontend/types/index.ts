export interface User {
  id: string;
  username: string;
  is_superuser: boolean;
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
  created_at: string;
}

export type WSMessage =
  | { type: "event_created"; room_id: string; payload: Event }
  | { type: "event_deleted"; room_id: string; payload: { event_id: string } }
  | { type: "response_updated"; room_id: string; payload: Response };
