const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function token() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "request failed" }));
    throw new Error(err.error || "request failed");
  }
  return res.json();
}

export const api = {
  auth: {
    register: (username: string, password: string) =>
      request("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      request<{ token: string; id: string; username: string; is_superuser: boolean }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ username, password }) }
      ),
  },
  rooms: {
    list: () => request<import("@/types").Room[]>("/api/rooms"),
    create: (name: string) =>
      request<import("@/types").Room>("/api/rooms", { method: "POST", body: JSON.stringify({ name }) }),
    join: (room_key: string) =>
      request<import("@/types").Room>("/api/rooms/join", { method: "POST", body: JSON.stringify({ room_key }) }),
    get: (id: string) => request<import("@/types").Room>(`/api/rooms/${id}`),
    members: (id: string) => request<import("@/types").User[]>(`/api/rooms/${id}/members`),
  },
  events: {
    list: (roomId: string) => request<import("@/types").Event[]>(`/api/rooms/${roomId}/events`),
    create: (roomId: string, data: { title: string; description: string; start_time: string; end_time: string }) =>
      request<import("@/types").Event>(`/api/rooms/${roomId}/events`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    respond: (roomId: string, eventId: string, data: object) =>
      request(`/api/rooms/${roomId}/events/${eventId}/respond`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (roomId: string, eventId: string) =>
      request(`/api/rooms/${roomId}/events/${eventId}`, { method: "DELETE" }),
  },
  wsUrl: (roomId: string) =>
    `${BASE.replace(/^http/, "ws")}/api/rooms/${roomId}/ws?token=${token()}`,
};
