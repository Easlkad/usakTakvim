package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/models"
)

type AdminHandler struct {
	db *sqlx.DB
}

func NewAdminHandler(db *sqlx.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// ListPendingUsers returns all users with status='pending'.
func (h *AdminHandler) ListPendingUsers(c *gin.Context) {
	users := []models.PendingUser{}
	err := h.db.Select(&users,
		`SELECT id, username, created_at FROM users WHERE status='pending' ORDER BY created_at ASC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pending users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

// ApproveUser sets a pending user's status to 'active'.
func (h *AdminHandler) ApproveUser(c *gin.Context) {
	userID := c.Param("id")

	result, err := h.db.Exec(
		`UPDATE users SET status='active' WHERE id=$1 AND status='pending'`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to approve user"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "pending user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"approved": true})
}

// RejectUser sets a pending user's status to 'rejected'.
func (h *AdminHandler) RejectUser(c *gin.Context) {
	userID := c.Param("id")

	result, err := h.db.Exec(
		`UPDATE users SET status='rejected' WHERE id=$1 AND status='pending'`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject user"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "pending user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"rejected": true})
}
