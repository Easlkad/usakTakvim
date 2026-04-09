package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/middleware"
	"usakTakvim/internal/models"
	"usakTakvim/internal/ws"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSHandler struct {
	db *sqlx.DB
}

func NewWSHandler(db *sqlx.DB) *WSHandler {
	return &WSHandler{db: db}
}

func (h *WSHandler) Handle(c *gin.Context) {
	roomID := c.Param("id")

	// WS connections can't set headers, so accept token from query param
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "changeme-secret"
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	userID := claims.UserID
	username := claims.Username
	isSuperuser := claims.IsSuperuser

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

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := ws.Global.NewClient(conn, roomID, userID, username)
	ws.Global.Register(client)

	go client.WritePump()
	go client.ReadPump(ws.Global, func(data []byte) {
		var incoming struct {
			Type    string `json:"type"`
			Content string `json:"content"`
		}
		if err := json.Unmarshal(data, &incoming); err != nil {
			return
		}
		if incoming.Type != "chat_message" {
			return
		}
		content := strings.TrimSpace(incoming.Content)
		if content == "" || len(content) > 1000 {
			return
		}

		var msg models.ChatMessage
		err := h.db.QueryRowx(
			`INSERT INTO messages (room_id, user_id, username, content)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, room_id, user_id, username, content, created_at`,
			roomID, userID, username, content,
		).StructScan(&msg)
		if err != nil {
			return
		}

		ws.Global.Broadcast(roomID, ws.Message{
			Type:    "chat_message",
			RoomID:  roomID,
			Payload: msg,
		})
	})
}
