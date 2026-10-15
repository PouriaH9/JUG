package handler

import (
	"context"
	"jug/backend/service"
	"log"
	"net/http"
	"sync"
	"time"
)

var mu sync.Mutex
var app *service.App

func Handler(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	if app == nil {
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		initialized, err := service.New(ctx)
		cancel()
		if err != nil {
			mu.Unlock()
			log.Print("API initialization failed: ", err)
			http.Error(w, "Service temporarily unavailable", 503)
			return
		}
		app = initialized
	}
	current := app
	mu.Unlock()
	current.ServeHTTP(w, r)
}
