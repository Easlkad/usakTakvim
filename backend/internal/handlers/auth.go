package handlers

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
	"usakTakvim/internal/middleware"
)

type AuthHandler struct {
	db           *sqlx.DB
	loginLimiter *middleware.IPRateLimiter
}

func NewAuthHandler(db *sqlx.DB, loginLimiter *middleware.IPRateLimiter) *AuthHandler {
	return &AuthHandler{db: db, loginLimiter: loginLimiter}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var body struct {
		Username string `json:"username" binding:"required,min=3,max=50"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	var id string
	err = h.db.QueryRow(
		`INSERT INTO users (username, password_hash, status) VALUES ($1, $2, 'pending') RETURNING id`,
		body.Username, string(hash),
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":       id,
		"username": body.Username,
		"message":  "Kaydınız alındı. Yönetici onayından sonra giriş yapabilirsiniz.",
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var body struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Rate limit keyed on IP+username — one user's attempts never block another's.
	if !h.loginLimiter.Allow(c.ClientIP() + ":" + body.Username) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin."})
		return
	}

	var id, hash, status string
	var isSuperuser bool
	err := h.db.QueryRow(
		`SELECT id, password_hash, is_superuser, status FROM users WHERE username=$1`,
		body.Username,
	).Scan(&id, &hash, &isSuperuser, &status)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı adı veya şifre hatalı"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı adı veya şifre hatalı"})
		return
	}

	if status == "pending" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Hesabınız henüz onaylanmadı. Lütfen yönetici onayını bekleyin."})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.Claims{
		UserID:      id,
		Username:    body.Username,
		IsSuperuser: isSuperuser,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		},
	})
	signed, err := token.SignedString([]byte(jwtSecret()))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":        signed,
		"id":           id,
		"username":     body.Username,
		"is_superuser": isSuperuser,
	})
}

func jwtSecret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return "changeme-secret"
}
