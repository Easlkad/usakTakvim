package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/models"
	"usakTakvim/internal/ws"
)

type EventHandler struct {
	db *sqlx.DB
}

func NewEventHandler(db *sqlx.DB) *EventHandler {
	return &EventHandler{db: db}
}

func (h *EventHandler) requireMembership(c *gin.Context, roomID string) bool {
	userID := c.GetString("user_id")
	isSuperuser := c.GetBool("is_superuser")
	if isSuperuser {
		return true
	}
	var count int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM room_members WHERE user_id=$1 AND room_id=$2`,
		userID, roomID,
	).Scan(&count)
	return count > 0
}

func (h *EventHandler) List(c *gin.Context) {
	roomID := c.Param("id")
	if !h.requireMembership(c, roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	events := []models.Event{}
	err := h.db.Select(&events,
		`SELECT e.id, e.room_id, e.created_by, u.username as creator_name,
		        e.title, e.description, e.start_time, e.end_time, e.created_at
		 FROM events e
		 JOIN users u ON u.id = e.created_by
		 WHERE e.room_id = $1
		 ORDER BY e.start_time ASC`,
		roomID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch events"})
		return
	}

	for i := range events {
		responses := []models.Response{}
		h.db.Select(&responses,
			`SELECT r.id, r.event_id, r.user_id, u.username,
			        r.response_type, r.alt_start_time, r.alt_end_time, r.note, r.created_at
			 FROM responses r
			 JOIN users u ON u.id = r.user_id
			 WHERE r.event_id = $1
			 ORDER BY r.created_at ASC`,
			events[i].ID,
		)
		events[i].Responses = responses
	}

	c.JSON(http.StatusOK, events)
}

func (h *EventHandler) Create(c *gin.Context) {
	roomID := c.Param("id")
	if !h.requireMembership(c, roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	var body struct {
		Title       string    `json:"title" binding:"required,min=1,max=200"`
		Description string    `json:"description"`
		StartTime   time.Time `json:"start_time" binding:"required"`
		EndTime     time.Time `json:"end_time" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	username := c.GetString("username")

	var event models.Event
	err := h.db.QueryRowx(
		`INSERT INTO events (room_id, created_by, title, description, start_time, end_time)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, room_id, created_by, title, description, start_time, end_time, created_at`,
		roomID, userID, body.Title, body.Description, body.StartTime, body.EndTime,
	).StructScan(&event)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create event"})
		return
	}
	event.CreatorName = username
	event.Responses = []models.Response{}

	ws.Global.Broadcast(roomID, ws.Message{
		Type:    "event_created",
		RoomID:  roomID,
		Payload: event,
	})

	c.JSON(http.StatusCreated, event)
}

func (h *EventHandler) Respond(c *gin.Context) {
	eventID := c.Param("eventId")
	userID := c.GetString("user_id")
	username := c.GetString("username")

	var roomID string
	err := h.db.QueryRow(`SELECT room_id FROM events WHERE id=$1`, eventID).Scan(&roomID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}

	if !h.requireMembership(c, roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	var body struct {
		ResponseType string     `json:"response_type" binding:"required,oneof=yes no alternative"`
		AltStartTime *time.Time `json:"alt_start_time"`
		AltEndTime   *time.Time `json:"alt_end_time"`
		Note         string     `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.ResponseType == "alternative" && (body.AltStartTime == nil || body.AltEndTime == nil) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "alt_start_time and alt_end_time required for alternative"})
		return
	}

	var response models.Response
	err = h.db.QueryRowx(
		`INSERT INTO responses (event_id, user_id, response_type, alt_start_time, alt_end_time, note)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (event_id, user_id) DO UPDATE
		   SET response_type = EXCLUDED.response_type,
		       alt_start_time = EXCLUDED.alt_start_time,
		       alt_end_time = EXCLUDED.alt_end_time,
		       note = EXCLUDED.note,
		       created_at = NOW()
		 RETURNING id, event_id, user_id, response_type, alt_start_time, alt_end_time, note, created_at`,
		eventID, userID, body.ResponseType, body.AltStartTime, body.AltEndTime, body.Note,
	).StructScan(&response)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save response"})
		return
	}
	response.Username = username

	ws.Global.Broadcast(roomID, ws.Message{
		Type:    "response_updated",
		RoomID:  roomID,
		Payload: response,
	})

	c.JSON(http.StatusOK, response)
}

func (h *EventHandler) Delete(c *gin.Context) {
	eventID := c.Param("eventId")
	userID := c.GetString("user_id")
	isSuperuser := c.GetBool("is_superuser")

	var createdBy, roomID string
	err := h.db.QueryRow(`SELECT created_by, room_id FROM events WHERE id=$1`, eventID).Scan(&createdBy, &roomID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}

	if !isSuperuser && createdBy != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the creator can delete this event"})
		return
	}

	h.db.Exec(`DELETE FROM events WHERE id=$1`, eventID)

	ws.Global.Broadcast(roomID, ws.Message{
		Type:    "event_deleted",
		RoomID:  roomID,
		Payload: gin.H{"event_id": eventID},
	})

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
