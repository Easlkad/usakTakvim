package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
	"usakTakvim/internal/middleware"
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
	isSuperuser := claims.IsSuperuser

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

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := ws.Global.NewClient(conn, roomID, userID)
	ws.Global.Register(client)

	go client.WritePump()
	go client.ReadPump(ws.Global)
}
