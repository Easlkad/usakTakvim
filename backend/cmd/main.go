package main

import (
	"log"
	"os"

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

	authH := handlers.NewAuthHandler(database)
	roomH := handlers.NewRoomHandler(database)
	eventH := handlers.NewEventHandler(database)
	wsH := handlers.NewWSHandler(database)

	auth := r.Group("/auth")
	{
		auth.POST("/register", authH.Register)
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
			rooms.GET("/:id/events", eventH.List)
			rooms.POST("/:id/events", eventH.Create)
			rooms.POST("/:id/events/:eventId/respond", eventH.Respond)
			rooms.DELETE("/:id/events/:eventId", eventH.Delete)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("starting on :%s", port)
	r.Run(":" + port)
}
