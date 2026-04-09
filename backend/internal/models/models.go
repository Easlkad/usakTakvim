package models

import "time"

type User struct {
	ID           string    `db:"id" json:"id"`
	Username     string    `db:"username" json:"username"`
	PasswordHash string    `db:"password_hash" json:"-"`
	IsSuperuser  bool      `db:"is_superuser" json:"is_superuser"`
	Status       string    `db:"status" json:"status"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// PendingUser is returned by admin endpoints — no password hash exposed.
type PendingUser struct {
	ID        string    `db:"id" json:"id"`
	Username  string    `db:"username" json:"username"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Room struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	RoomKey   string    `db:"room_key" json:"room_key,omitempty"`
	CreatedBy string    `db:"created_by" json:"created_by"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Event struct {
	ID          string     `db:"id" json:"id"`
	RoomID      string     `db:"room_id" json:"room_id"`
	CreatedBy   string     `db:"created_by" json:"created_by"`
	CreatorName string     `db:"creator_name" json:"creator_name"`
	Title       string     `db:"title" json:"title"`
	Description string     `db:"description" json:"description"`
	StartTime   time.Time  `db:"start_time" json:"start_time"`
	EndTime     time.Time  `db:"end_time" json:"end_time"`
	// Status is prepared for future approval flow; currently always 'active'.
	Status      string     `db:"status" json:"status"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	Responses   []Response `db:"-" json:"responses"`
}

type ChatMessage struct {
	ID        string    `db:"id"         json:"id"`
	RoomID    string    `db:"room_id"    json:"room_id"`
	UserID    string    `db:"user_id"    json:"user_id"`
	Username  string    `db:"username"   json:"username"`
	Content   string    `db:"content"    json:"content"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Response struct {
	ID           string     `db:"id" json:"id"`
	EventID      string     `db:"event_id" json:"event_id"`
	UserID       string     `db:"user_id" json:"user_id"`
	Username     string     `db:"username" json:"username"`
	ResponseType string     `db:"response_type" json:"response_type"`
	AltStartTime *time.Time `db:"alt_start_time" json:"alt_start_time,omitempty"`
	AltEndTime   *time.Time `db:"alt_end_time" json:"alt_end_time,omitempty"`
	Note         string     `db:"note" json:"note"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}
