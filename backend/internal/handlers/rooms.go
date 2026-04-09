package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/models"
	"usakTakvim/internal/ws"
)

type RoomHandler struct {
	db *sqlx.DB
}

func NewRoomHandler(db *sqlx.DB) *RoomHandler {
	return &RoomHandler{db: db}
}

// isOwnerOrSuperuser returns true if the current user created this room or is a superuser.
func (h *RoomHandler) isOwnerOrSuperuser(c *gin.Context, roomID string) bool {
	if c.GetBool("is_superuser") {
		return true
	}
	userID := c.GetString("user_id")
	var createdBy string
	if err := h.db.QueryRow(`SELECT created_by FROM rooms WHERE id=$1`, roomID).Scan(&createdBy); err != nil {
		return false
	}
	return createdBy == userID
}

func (h *RoomHandler) Create(c *gin.Context) {
	var body struct {
		Name string `json:"name" binding:"required,min=1,max=100"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	key, err := generateKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate key"})
		return
	}

	var room models.Room
	err = h.db.QueryRowx(
		`INSERT INTO rooms (name, room_key, created_by) VALUES ($1, $2, $3)
		 RETURNING id, name, room_key, created_by, created_at`,
		body.Name, key, userID,
	).StructScan(&room)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
		return
	}

	// Creator auto-joins as active member
	h.db.Exec(
		`INSERT INTO room_members (user_id, room_id, status) VALUES ($1, $2, 'active')`,
		userID, room.ID,
	)

	c.JSON(http.StatusCreated, room)
}

func (h *RoomHandler) Join(c *gin.Context) {
	var body struct {
		RoomKey string `json:"room_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")

	var room models.Room
	err := h.db.QueryRowx(
		`SELECT id, name, created_by, created_at FROM rooms WHERE room_key=$1`,
		body.RoomKey,
	).StructScan(&room)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invalid room key"})
		return
	}

	// Check if already a member
	var existingStatus string
	err = h.db.QueryRow(
		`SELECT status FROM room_members WHERE user_id=$1 AND room_id=$2`,
		userID, room.ID,
	).Scan(&existingStatus)
	if err == nil {
		// Already exists — return current state
		c.JSON(http.StatusOK, gin.H{
			"id":      room.ID,
			"name":    room.Name,
			"pending": existingStatus == "pending",
		})
		return
	}

	// New request — insert as pending
	_, err = h.db.Exec(
		`INSERT INTO room_members (user_id, room_id, status) VALUES ($1, $2, 'pending')`,
		userID, room.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to request join"})
		return
	}

	// Notify room members that someone requested to join
	var username string
	h.db.QueryRow(`SELECT username FROM users WHERE id=$1`, userID).Scan(&username)
	ws.Global.Broadcast(room.ID, ws.Message{
		Type:   "member_requested",
		RoomID: room.ID,
		Payload: gin.H{"user_id": userID, "username": username},
	})

	c.JSON(http.StatusOK, gin.H{
		"id":      room.ID,
		"name":    room.Name,
		"pending": true,
	})
}

func (h *RoomHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")
	isSuperuser := c.GetBool("is_superuser")

	rooms := []models.Room{}
	var err error

	if isSuperuser {
		err = h.db.Select(&rooms, `SELECT id, name, room_key, created_by, created_at FROM rooms ORDER BY created_at DESC`)
	} else {
		err = h.db.Select(&rooms,
			`SELECT r.id, r.name, r.created_by, r.created_at
			 FROM rooms r
			 JOIN room_members rm ON rm.room_id = r.id
			 WHERE rm.user_id = $1 AND rm.status = 'active'
			 ORDER BY r.created_at DESC`,
			userID,
		)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch rooms"})
		return
	}

	c.JSON(http.StatusOK, rooms)
}

func (h *RoomHandler) Get(c *gin.Context) {
	roomID := c.Param("id")
	userID := c.GetString("user_id")
	isSuperuser := c.GetBool("is_superuser")

	if !isSuperuser {
		var count int
		h.db.QueryRow(
			`SELECT COUNT(*) FROM room_members WHERE user_id=$1 AND room_id=$2 AND status='active'`,
			userID, roomID,
		).Scan(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this room"})
			return
		}
	}

	var room models.Room
	err := h.db.QueryRowx(
		`SELECT id, name, room_key, created_by, created_at FROM rooms WHERE id=$1`,
		roomID,
	).StructScan(&room)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	if room.CreatedBy != userID && !isSuperuser {
		room.RoomKey = ""
	}

	c.JSON(http.StatusOK, room)
}

// Members returns active room members.
func (h *RoomHandler) Members(c *gin.Context) {
	roomID := c.Param("id")
	userID := c.GetString("user_id")
	isSuperuser := c.GetBool("is_superuser")

	if !isSuperuser {
		var count int
		h.db.QueryRow(
			`SELECT COUNT(*) FROM room_members WHERE user_id=$1 AND room_id=$2 AND status='active'`,
			userID, roomID,
		).Scan(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
			return
		}
	}

	members := []models.RoomMember{}
	err := h.db.Select(&members,
		`SELECT rm.user_id, u.username, u.is_superuser, rm.status, rm.joined_at
		 FROM room_members rm
		 JOIN users u ON u.id = rm.user_id
		 WHERE rm.room_id = $1 AND rm.status = 'active'
		 ORDER BY rm.joined_at ASC`,
		roomID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

// PendingMembers returns members with pending join requests (owner/superuser only).
func (h *RoomHandler) PendingMembers(c *gin.Context) {
	roomID := c.Param("id")
	if !h.isOwnerOrSuperuser(c, roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only room owner or superuser"})
		return
	}

	pending := []models.RoomMember{}
	err := h.db.Select(&pending,
		`SELECT rm.user_id, u.username, u.is_superuser, rm.status, rm.joined_at
		 FROM room_members rm
		 JOIN users u ON u.id = rm.user_id
		 WHERE rm.room_id = $1 AND rm.status = 'pending'
		 ORDER BY rm.joined_at ASC`,
		roomID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pending members"})
		return
	}

	c.JSON(http.StatusOK, pending)
}

// ApproveMember approves a pending join request (owner/superuser only).
func (h *RoomHandler) ApproveMember(c *gin.Context) {
	roomID := c.Param("id")
	targetUserID := c.Param("userId")

	if !h.isOwnerOrSuperuser(c, roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only room owner or superuser"})
		return
	}

	result, err := h.db.Exec(
		`UPDATE room_members SET status='active' WHERE user_id=$1 AND room_id=$2 AND status='pending'`,
		targetUserID, roomID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to approve member"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "pending request not found"})
		return
	}

	var username string
	h.db.QueryRow(`SELECT username FROM users WHERE id=$1`, targetUserID).Scan(&username)
	ws.Global.Broadcast(roomID, ws.Message{
		Type:    "member_approved",
		RoomID:  roomID,
		Payload: gin.H{"user_id": targetUserID, "username": username},
	})

	c.JSON(http.StatusOK, gin.H{"approved": true})
}

// RemoveMember kicks an active member or rejects a pending request (owner/superuser only).
func (h *RoomHandler) RemoveMember(c *gin.Context) {
	roomID := c.Param("id")
	targetUserID := c.Param("userId")
	currentUserID := c.GetString("user_id")

	if !h.isOwnerOrSuperuser(c, roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only room owner or superuser"})
		return
	}

	// Cannot remove the room creator
	var createdBy string
	h.db.QueryRow(`SELECT created_by FROM rooms WHERE id=$1`, roomID).Scan(&createdBy)
	if targetUserID == createdBy {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove the room creator"})
		return
	}
	if targetUserID == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove yourself"})
		return
	}

	result, err := h.db.Exec(
		`DELETE FROM room_members WHERE user_id=$1 AND room_id=$2`,
		targetUserID, roomID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}

	ws.Global.Broadcast(roomID, ws.Message{
		Type:    "member_removed",
		RoomID:  roomID,
		Payload: gin.H{"user_id": targetUserID},
	})

	c.JSON(http.StatusOK, gin.H{"removed": true})
}

func generateKey() (string, error) {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
