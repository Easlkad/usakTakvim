package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/models"
)

type RoomHandler struct {
	db *sqlx.DB
}

func NewRoomHandler(db *sqlx.DB) *RoomHandler {
	return &RoomHandler{db: db}
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

	// creator auto-joins
	h.db.Exec(`INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)`, userID, room.ID)

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

	_, err = h.db.Exec(
		`INSERT INTO room_members (user_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, room.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join room"})
		return
	}

	c.JSON(http.StatusOK, room)
}

func (h *RoomHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")
	isSuperuser := c.GetBool("is_superuser")

	var rooms []models.Room
	var err error

	if isSuperuser {
		err = h.db.Select(&rooms, `SELECT id, name, room_key, created_by, created_at FROM rooms ORDER BY created_at DESC`)
	} else {
		err = h.db.Select(&rooms,
			`SELECT r.id, r.name, r.created_by, r.created_at
			 FROM rooms r
			 JOIN room_members rm ON rm.room_id = r.id
			 WHERE rm.user_id = $1
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
			`SELECT COUNT(*) FROM room_members WHERE user_id=$1 AND room_id=$2`,
			userID, roomID,
		).Scan(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this room"})
			return
		}
	}

	var room models.Room
	err := h.db.QueryRowx(
		`SELECT id, name, created_by, created_at FROM rooms WHERE id=$1`,
		roomID,
	).StructScan(&room)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	c.JSON(http.StatusOK, room)
}

func (h *RoomHandler) Members(c *gin.Context) {
	roomID := c.Param("id")
	userID := c.GetString("user_id")

	var count int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM room_members WHERE user_id=$1 AND room_id=$2`,
		userID, roomID,
	).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	var members []models.User
	err := h.db.Select(&members,
		`SELECT u.id, u.username, u.is_superuser, u.created_at
		 FROM users u
		 JOIN room_members rm ON rm.user_id = u.id
		 WHERE rm.room_id = $1
		 ORDER BY rm.joined_at ASC`,
		roomID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

func generateKey() (string, error) {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
