package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type windowEntry struct {
	count       int
	windowStart time.Time
}

type ipRateLimiter struct {
	mu     sync.Mutex
	store  map[string]*windowEntry
	max    int
	window time.Duration
}

func newIPRateLimiter(max int, window time.Duration) *ipRateLimiter {
	rl := &ipRateLimiter{
		store:  make(map[string]*windowEntry),
		max:    max,
		window: window,
	}
	go rl.cleanup()
	return rl
}

// cleanup removes stale entries every 10 minutes to prevent unbounded memory growth.
func (rl *ipRateLimiter) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for ip, e := range rl.store {
			if e.windowStart.Before(cutoff) {
				delete(rl.store, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *ipRateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	e, ok := rl.store[ip]
	if !ok || now.Sub(e.windowStart) > rl.window {
		rl.store[ip] = &windowEntry{count: 1, windowStart: now}
		return true
	}
	if e.count >= rl.max {
		return false
	}
	e.count++
	return true
}

// RateLimit returns a Gin middleware that limits requests to max per IP per window.
// Uses a fixed-window counter; each IP gets a fresh window after the current one expires.
func RateLimit(max int, window time.Duration) gin.HandlerFunc {
	rl := newIPRateLimiter(max, window)
	return func(c *gin.Context) {
		if !rl.allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.",
			})
			return
		}
		c.Next()
	}
}
