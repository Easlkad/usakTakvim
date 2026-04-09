package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/models"
)

type NotificationHandler struct {
	db *sqlx.DB
}

func NewNotificationHandler(db *sqlx.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

// List returns the 50 most recent notifications for the current user.
func (h *NotificationHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")

	notifications := []models.Notification{}
	err := h.db.Select(&notifications,
		`SELECT n.id, n.user_id, n.type, n.title, n.body, n.room_id,
		        COALESCE(r.name, '') AS room_name,
		        n.resource_id, n.read, n.created_at
		 FROM notifications n
		 LEFT JOIN rooms r ON r.id = n.room_id
		 WHERE n.user_id = $1
		 ORDER BY n.created_at DESC
		 LIMIT 50`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications"})
		return
	}

	c.JSON(http.StatusOK, notifications)
}

// MarkAllRead marks all notifications as read for the current user.
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID := c.GetString("user_id")
	h.db.Exec(`UPDATE notifications SET read=true WHERE user_id=$1`, userID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
