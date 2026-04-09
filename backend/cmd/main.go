package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"usakTakvim/internal/db"
	"usakTakvim/internal/handlers"
	"usakTakvim/internal/middleware"
)

func main() {
	_ = godotenv.Load()

	database, err := db.Connect()
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	db.Migrate(database)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", os.Getenv("FRONTEND_URL"))
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Login limiter keys on IP+username so one user's attempts never block another's.
	// 10 attempts per IP+username combo per 5 minutes.
	loginLimiter := middleware.NewLimiter(10, 5*time.Minute)

	authH  := handlers.NewAuthHandler(database, loginLimiter)
	roomH  := handlers.NewRoomHandler(database)
	eventH := handlers.NewEventHandler(database)
	wsH    := handlers.NewWSHandler(database)
	adminH := handlers.NewAdminHandler(database)
	chatH  := handlers.NewChatHandler(database)

	auth := r.Group("/auth")
	{
		// 20 registration attempts per IP per hour — accounts go to pending anyway.
		auth.POST("/register", middleware.RateLimit(20, time.Hour), authH.Register)
		// Login rate limiting is handled inside the handler, keyed on IP+username.
		auth.POST("/login", authH.Login)
	}

	// WS is outside auth middleware — it handles its own token validation via query param
	r.GET("/api/rooms/:id/ws", wsH.Handle)

	api := r.Group("/api", middleware.Auth())
	{
		rooms := api.Group("/rooms")
		{
			rooms.GET("", roomH.List)
			rooms.POST("", middleware.SuperuserOnly(), roomH.Create)
			rooms.POST("/join", roomH.Join)
			rooms.GET("/:id", roomH.Get)
			rooms.GET("/:id/members", roomH.Members)
			rooms.GET("/:id/members/pending", roomH.PendingMembers)
			rooms.POST("/:id/members/:userId/approve", roomH.ApproveMember)
			rooms.DELETE("/:id/members/:userId", roomH.RemoveMember)
			rooms.GET("/:id/events", eventH.List)
			rooms.POST("/:id/events", eventH.Create)
			rooms.POST("/:id/events/:eventId/respond", eventH.Respond)
			rooms.POST("/:id/events/:eventId/responses/:responseId/vote", eventH.VoteAlternative)
			rooms.DELETE("/:id/events/:eventId", eventH.Delete)
			rooms.GET("/:id/messages", chatH.List)
		}

		admin := api.Group("/admin", middleware.SuperuserOnly())
		{
			admin.GET("/users/pending", adminH.ListPendingUsers)
			admin.POST("/users/:id/approve", adminH.ApproveUser)
			admin.POST("/users/:id/reject", adminH.RejectUser)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("starting on :%s", port)
	r.Run(":" + port)
}
