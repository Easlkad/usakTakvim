package ws

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type Message struct {
	Type    string      `json:"type"`
	RoomID  string      `json:"room_id"`
	Payload interface{} `json:"payload"`
}

type Client struct {
	conn     *websocket.Conn
	roomID   string
	userID   string
	username string
	send     chan []byte
}

type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]bool
}

var Global = &Hub{
	rooms: make(map[string]map[*Client]bool),
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[client.roomID] == nil {
		h.rooms[client.roomID] = make(map[*Client]bool)
	}
	h.rooms[client.roomID][client] = true
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.rooms[client.roomID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.rooms, client.roomID)
		}
	}
}

func (h *Hub) Broadcast(roomID string, msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.rooms[roomID] {
		select {
		case client.send <- data:
		default:
			close(client.send)
		}
	}
}

func (h *Hub) NewClient(conn *websocket.Conn, roomID, userID, username string) *Client {
	return &Client{
		conn:     conn,
		roomID:   roomID,
		userID:   userID,
		username: username,
		send:     make(chan []byte, 256),
	}
}

func (c *Client) WritePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

// ReadPump reads messages from the client connection.
// onMessage is called for each message received; pass nil to discard all.
func (c *Client) ReadPump(hub *Hub, onMessage func(data []byte)) {
	defer func() {
		hub.Unregister(c)
		c.conn.Close()
	}()
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		if onMessage != nil {
			onMessage(data)
		}
	}
}
