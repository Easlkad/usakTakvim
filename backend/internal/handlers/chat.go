package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/models"
)

type ChatHandler struct {
	db *sqlx.DB
}

func NewChatHandler(db *sqlx.DB) *ChatHandler {
	return &ChatHandler{db: db}
}

// List returns the last 50 messages for a room in ascending order.
func (h *ChatHandler) List(c *gin.Context) {
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
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
			return
		}
	}

	messages := []models.ChatMessage{}
	err := h.db.Select(&messages, `
		SELECT id, room_id, user_id, username, content, created_at FROM (
			SELECT id, room_id, user_id, username, content, created_at
			FROM messages
			WHERE room_id = $1
			ORDER BY created_at DESC
			LIMIT 50
		) sub
		ORDER BY created_at ASC
	`, roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, messages)
}
