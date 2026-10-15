package service

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
)

// Runs against a dedicated test database when explicitly configured.
func TestPostgresInstancesShareState(t *testing.T) {
	dsn := os.Getenv("JUG_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("JUG_TEST_DATABASE_URL is not configured")
	}
	t.Setenv("DATABASE_URL", dsn)
	if os.Getenv("ADMIN_EMAIL") == "" || len(os.Getenv("ADMIN_PASSWORD")) < 16 {
		t.Fatal("integration test requires configured administrator credentials")
	}
	a, err := New(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer a.db.Close()
	b, err := New(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer b.db.Close()
	email := "test-" + id() + "@example.com"
	result := request(a, "POST", "auth/register", `{"name":"Instance Test","email":"`+email+`","password":"test-password-123"}`, "")
	if result.Code != 200 {
		t.Fatalf("register: %d %s", result.Code, result.Body.String())
	}
	var auth struct {
		Token string
		User  User
	}
	if err = json.Unmarshal(result.Body.Bytes(), &auth); err != nil {
		t.Fatal(err)
	}
	if got := request(b, "GET", "auth/me", "", auth.Token); got.Code != 200 {
		t.Fatalf("other instance cannot read session: %d %s", got.Code, got.Body.String())
	}
	var wg sync.WaitGroup
	for i, instance := range []*App{a, b} {
		wg.Add(1)
		go func(i int, instance *App) {
			defer wg.Done()
			path := "wishlist"
			body := `{"productIds":["ember-solo"]}`
			if i == 1 {
				path = "cart"
				body = `{"items":[{"productId":"ivory-solo","quantity":1}]}`
			}
			got := request(instance, "PUT", path, body, auth.Token)
			if got.Code != 200 {
				t.Errorf("wishlist write: %d %s", got.Code, got.Body.String())
			}
		}(i, instance)
	}
	wg.Wait()
	// Remove test-created personal data while preserving the catalog and other users.
	tx, err := a.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`SELECT pg_advisory_xact_lock(74192026)`); err != nil {
		t.Fatal(err)
	}
	var raw []byte
	if err = tx.QueryRow(`SELECT data FROM jug_state WHERE id=1`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var state State
	if err = json.Unmarshal(raw, &state); err != nil {
		t.Fatal(err)
	}
	if len(state.Wishlists[auth.User.ID]) != 1 || len(state.Carts[auth.User.ID]) != 1 {
		t.Errorf("concurrent writes lost: %v", state.Wishlists[auth.User.ID])
	}
	delete(state.Users, auth.User.ID)
	delete(state.Wishlists, auth.User.ID)
	delete(state.Carts, auth.User.ID)
	for key, session := range state.Sessions {
		if session.UserID == auth.User.ID {
			delete(state.Sessions, key)
		}
	}
	raw, _ = json.Marshal(state)
	if _, err = tx.Exec(`UPDATE jug_state SET data=$1 WHERE id=1`, raw); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

func TestProductionRequiresExplicitCredentials(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://unused")
	t.Setenv("ADMIN_PASSWORD", "")
	t.Setenv("ADMIN_EMAIL", "")
	if _, err := New(context.Background()); err == nil {
		t.Fatal("production accepted default administrator credentials")
	}
}
func TestVercelRejectsDemoPersistence(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JUG_DEMO", "true")
	t.Setenv("VERCEL", "1")
	if _, err := New(context.Background()); err == nil {
		t.Fatal("Vercel accepted ephemeral demo persistence")
	}
}
