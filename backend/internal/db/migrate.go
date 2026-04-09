package db

import (
	"log"

	"github.com/jmoiron/sqlx"
)

// Migrate runs pending schema migrations on startup.
// Each migration is idempotent and tracked in schema_migrations.
func Migrate(database *sqlx.DB) {
	database.MustExec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name       VARCHAR(100) PRIMARY KEY,
			applied_at TIMESTAMPTZ  DEFAULT NOW()
		)
	`)

	migrations := []struct {
		name string
		sql  string
	}{
		{
			name: "add_user_status",
			sql: `
				ALTER TABLE users
				ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
				CHECK (status IN ('pending', 'active'));
			`,
		},
		{
			// Prepared for future event approval flow — not yet enforced.
			name: "add_event_status",
			sql: `
				ALTER TABLE events
				ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
				CHECK (status IN ('pending', 'active'));
			`,
		},
		{
			name: "create_alternative_votes_table",
			sql: `
				CREATE TABLE IF NOT EXISTS alternative_votes (
					response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
					user_id     UUID REFERENCES users(id)    ON DELETE CASCADE,
					created_at  TIMESTAMPTZ DEFAULT NOW(),
					PRIMARY KEY (response_id, user_id)
				);
			`,
		},
		{
			name: "create_messages_table",
			sql: `
				CREATE TABLE IF NOT EXISTS messages (
					id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					room_id    UUID REFERENCES rooms(id) ON DELETE CASCADE,
					user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
					username   VARCHAR(50) NOT NULL,
					content    TEXT NOT NULL,
					created_at TIMESTAMPTZ DEFAULT NOW()
				);
				CREATE INDEX IF NOT EXISTS idx_messages_room_created
					ON messages (room_id, created_at DESC);
			`,
		},
	}

	for _, m := range migrations {
		var count int
		database.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE name=$1`, m.name).Scan(&count)
		if count > 0 {
			continue
		}
		if _, err := database.Exec(m.sql); err != nil {
			log.Fatalf("migration %q failed: %v", m.name, err)
		}
		database.Exec(`INSERT INTO schema_migrations (name) VALUES ($1)`, m.name)
		log.Printf("migration applied: %s", m.name)
	}
}
