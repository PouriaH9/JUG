package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed courses.md
var courseContent string

func authoredLessons() map[string][]map[string]string {
	result := map[string][]map[string]string{}
	sections := strings.Split(courseContent, "## Course: ")
	ids := []string{"first-cascade", "flow-lab"}
	for index, section := range sections[1:] {
		if index >= len(ids) {
			break
		}
		for _, lesson := range strings.Split(section, "### ")[1:] {
			lines := strings.SplitN(lesson, "\n", 2)
			if len(lines) < 2 {
				continue
			}
			body := strings.TrimSpace(lines[1])
			pieces := strings.SplitN(body, "Completion task:", 2)
			task := ""
			if len(pieces) > 1 {
				task = strings.TrimSpace(pieces[1])
			}
			result[ids[index]] = append(result[ids[index]], map[string]string{"title": strings.TrimSpace(lines[0]), "content": strings.TrimSpace(pieces[0]), "task": task, "url": ""})
		}
	}
	return result
}

type Product struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	Price       int     `json:"price"`
	Category    string  `json:"category"`
	Color       string  `json:"color"`
	Weight      int     `json:"weight"`
	Stock       int     `json:"stock"`
	Image       string  `json:"image"`
	Featured    bool    `json:"featured"`
	Rating      float64 `json:"rating"`
}
type Course struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Level       string              `json:"level"`
	Duration    string              `json:"duration"`
	Price       int                 `json:"price"`
	Image       string              `json:"image"`
	Lessons     []map[string]string `json:"lessons"`
}
type User struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	Hash         string `json:"-"`
	PasswordHash string `json:"passwordHash,omitempty"`
}
type Item struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
	Name      string `json:"name,omitempty"`
	Price     int    `json:"price,omitempty"`
}
type Order struct {
	ID            string         `json:"id"`
	UserID        string         `json:"userId"`
	Items         []Item         `json:"items"`
	Total         int            `json:"total"`
	Discount      int            `json:"discount"`
	ShippingFee   int            `json:"shippingFee"`
	Status        string         `json:"status"`
	PaymentStatus string         `json:"paymentStatus"`
	CreatedAt     string         `json:"createdAt"`
	Address       map[string]any `json:"address"`
}
type Review struct {
	ID      string `json:"id"`
	UserID  string `json:"userId"`
	Name    string `json:"name"`
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}
type Session struct {
	UserID  string    `json:"userId"`
	Expires time.Time `json:"expires"`
}
type State struct {
	Discounts map[string]Discount `json:"discounts"`
	Settings  Settings            `json:"settings"`
	Products  map[string]Product  `json:"products"`
	Courses   map[string]Course   `json:"courses"`
	Users     map[string]User     `json:"users"`
	Sessions  map[string]Session  `json:"sessions"`
	Orders    map[string]Order    `json:"orders"`
	Carts     map[string][]Item   `json:"carts"`
	Wishlists map[string][]string `json:"wishlists"`
	Reviews   map[string][]Review `json:"reviews"`
}
type Discount struct {
	Code    string `json:"code"`
	Percent int    `json:"percent"`
	Active  bool   `json:"active"`
}
type Settings struct {
	ShippingFee           int `json:"shippingFee"`
	FreeShippingThreshold int `json:"freeShippingThreshold"`
}
type App struct {
	mu       sync.Mutex
	state    State
	db       *sql.DB
	tx       *sql.Tx
	demo     string
	before   []byte
	attempts map[string]loginAttempt
}
type loginAttempt struct {
	Count int
	Reset time.Time
}

func id() string {
	b := make([]byte, 16)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func digest(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func publicUser(u User) User { u.PasswordHash = ""; return u }
func initial() State {
	s := State{Products: map[string]Product{}, Courses: map[string]Course{}, Users: map[string]User{}, Sessions: map[string]Session{}, Orders: map[string]Order{}, Carts: map[string][]Item{}, Wishlists: map[string][]string{}, Reviews: map[string][]Review{}}
	s.Discounts = map[string]Discount{"FIRST10": {Code: "FIRST10", Percent: 10, Active: true}}
	products := []Product{
		{ID: "ember-set", Name: "EMBER / Set of 3", Slug: "ember-set", Description: "A precision balanced three-ball set. Soft touch, confident grip, and a rich burnt-orange finish.", Price: 1290000, Category: "set", Color: "Burnt orange", Weight: 120, Stock: 40, Featured: true, Rating: 4.9},
		{ID: "carbon-set", Name: "CARBON / Set of 3", Slug: "carbon-set", Description: "Understated charcoal. Consistent weight and a forgiving catch for your daily practice.", Price: 1290000, Category: "set", Color: "Charcoal", Weight: 120, Stock: 30, Featured: true, Rating: 4.8},
		{ID: "ember-solo", Name: "EMBER / Single", Slug: "ember-solo", Description: "One perfectly weighted ball. Expand your pattern, replace a favorite, or start something new.", Price: 450000, Category: "solo", Color: "Burnt orange", Weight: 120, Stock: 100, Featured: true, Rating: 4.9},
		{ID: "ivory-solo", Name: "IVORY / Single", Slug: "ivory-solo", Description: "A warm ivory finish with the same precise balance. Built for focus and fluid movement.", Price: 450000, Category: "solo", Color: "Ivory", Weight: 120, Stock: 60, Rating: 4.7},
	}
	for _, p := range products {
		s.Products[p.ID] = p
	}
	for _, c := range []Course{{ID: "first-cascade", Title: "Your first cascade", Description: "Build your rhythm from the first throw to a confident three-ball cascade.", Level: "Beginner", Duration: "35 min", Price: 0, Lessons: []map[string]string{{"title": "One ball, one rhythm", "url": ""}, {"title": "The two-ball exchange", "url": ""}, {"title": "Your first cascade", "url": ""}}}, {ID: "flow-lab", Title: "The flow lab", Description: "Refine your technique and explore transitions, columns, and expressive patterns.", Level: "Intermediate", Duration: "55 min", Price: 290000, Lessons: []map[string]string{{"title": "Clean foundations", "url": ""}, {"title": "Columns and transitions", "url": ""}}}} {
		s.Courses[c.ID] = c
	}
	for key, lessons := range authoredLessons() {
		c := s.Courses[key]
		c.Price = 0
		c.Lessons = lessons
		aTitle := map[string]string{"first-cascade": "First Three-Ball Cascade", "flow-lab": "Precision and Pattern Lab"}
		c.Title = aTitle[key]
		s.Courses[key] = c
	}
	h, _ := bcrypt.GenerateFromPassword([]byte(env("ADMIN_PASSWORD", "JugAdmin!2026")), bcrypt.DefaultCost)
	s.Users["admin"] = User{ID: "admin", Name: "JUG Studio", Email: env("ADMIN_EMAIL", "admin@jug.local"), Role: "admin", PasswordHash: string(h)}
	return s
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func (a *App) save() error {
	b, e := json.Marshal(a.state)
	if e != nil {
		return e
	}
	if a.tx != nil {
		_, e = a.tx.Exec(`UPDATE jug_state SET data=$1, updated_at=now() WHERE id=1`, b)
		return e
	}
	if e = os.WriteFile(a.demo+".tmp", b, 0600); e != nil {
		return e
	}
	return os.Rename(a.demo+".tmp", a.demo)
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if json.NewDecoder(r.Body).Decode(v) != nil {
		fail(w, 400, "Invalid request body")
		return false
	}
	return true
}
func (a *App) user(r *http.Request) (User, bool) {
	s, ok := a.state.Sessions[digest(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))]
	if !ok || time.Now().After(s.Expires) {
		return User{}, false
	}
	u, ok := a.state.Users[s.UserID]
	return u, ok
}
func (a *App) commit(w http.ResponseWriter, v any) {
	if e := a.save(); e != nil {
		a.state = State{}
		json.Unmarshal(a.before, &a.state)
		log.Println("persistence error", e)
		fail(w, 503, "Storage unavailable")
		return
	}
	respond(w, 200, v)
}
func priceOrder(products map[string]Product, items []Item, code string) ([]Item, int, int, error) {
	if len(items) == 0 || len(items) > 50 {
		return nil, 0, 0, errors.New("Cart must contain 1–50 items")
	}
	merged := map[string]int{}
	for _, i := range items {
		if i.Quantity < 1 || i.Quantity > 100 {
			return nil, 0, 0, errors.New("Invalid quantity")
		}
		merged[i.ProductID] += i.Quantity
	}
	total := 0
	out := []Item{}
	for k, q := range merged {
		p, ok := products[k]
		if !ok || q > p.Stock {
			return nil, 0, 0, errors.New("Product unavailable or insufficient stock")
		}
		total += p.Price * q
		out = append(out, Item{ProductID: k, Quantity: q, Name: p.Name, Price: p.Price})
	}
	discount := 0
	if code != "" {
		if strings.ToUpper(code) != "FIRST10" {
			return nil, 0, 0, errors.New("Invalid discount code")
		}
		discount = total / 10
	}
	return out, total - discount, discount, nil
}
func (a *App) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == env("FRONTEND_ORIGIN", "http://localhost:3000") || origin == "http://127.0.0.1:3000" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if r.Method == "OPTIONS" {
		w.WriteHeader(204)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/media/") {
		serveMedia(w, r)
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.db != nil {
		tx, err := a.db.BeginTx(r.Context(), nil)
		if err != nil {
			fail(w, 503, "Storage unavailable")
			return
		}
		defer tx.Rollback()
		if _, err = tx.ExecContext(r.Context(), "SELECT pg_advisory_xact_lock(74192026)"); err != nil {
			fail(w, 503, "Storage unavailable")
			return
		}
		var data []byte
		if err = tx.QueryRowContext(r.Context(), "SELECT data FROM jug_state WHERE id=1").Scan(&data); err != nil {
			fail(w, 503, "Storage unavailable")
			return
		}
		var current State
		if err = json.Unmarshal(data, &current); err != nil {
			fail(w, 503, "Storage unavailable")
			return
		}
		a.state = current
		a.tx = tx
		defer func() { a.tx = nil }()
		buffered := &bufferedResponse{header: make(http.Header)}
		a.before, _ = json.Marshal(a.state)
		a.handle(buffered, r)
		if buffered.status < 400 {
			if err = tx.Commit(); err != nil {
				_ = json.Unmarshal(a.before, &a.state)
				fail(w, 503, "Storage unavailable")
				return
			}
		} else {
			_ = json.Unmarshal(a.before, &a.state)
		}
		for key, values := range buffered.header {
			for _, value := range values {
				w.Header().Add(key, value)
			}
		}
		w.WriteHeader(buffered.status)
		_, _ = w.Write(buffered.body.Bytes())
		return
	}
	a.before, _ = json.Marshal(a.state)
	a.handle(w, r)
}

type bufferedResponse struct {
	header http.Header
	body   bytes.Buffer
	status int
}

func (w *bufferedResponse) Header() http.Header { return w.header }
func (w *bufferedResponse) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
}
func (w *bufferedResponse) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.status = 200
	}
	return w.body.Write(data)
}
func (a *App) handle(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/"), "/")
	parts := strings.Split(path, "/")
	u, authed := a.user(r)
	if path == "health" {
		respond(w, 200, map[string]any{"status": "ok", "storage": map[bool]string{true: "postgresql", false: "demo-json"}[a.db != nil], "testPayments": true})
		return
	}
	if path == "settings" && r.Method == "GET" {
		respond(w, 200, map[string]any{"settings": a.state.Settings})
		return
	}
	if len(parts) == 2 && parts[0] == "courses" && r.Method == "GET" {
		c, ok := a.state.Courses[parts[1]]
		if !ok {
			fail(w, 404, "Course not found")
			return
		}
		respond(w, 200, map[string]any{"course": c})
		return
	}
	if path == "auth/register" || path == "auth/login" {
		if r.Method != "POST" {
			fail(w, 405, "Use POST")
			return
		}
		if a.attempts == nil {
			a.attempts = map[string]loginAttempt{}
		}
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		attempt := a.attempts[ip]
		if time.Now().After(attempt.Reset) {
			attempt = loginAttempt{Reset: time.Now().Add(5 * time.Minute)}
		}
		attempt.Count++
		a.attempts[ip] = attempt
		if attempt.Count > 20 {
			w.Header().Set("Retry-After", "300")
			fail(w, 429, "Too many attempts; try again in five minutes")
			return
		}
		var b struct{ Name, Email, Password string }
		if !decode(w, r, &b) {
			return
		}
		b.Email = strings.ToLower(strings.TrimSpace(b.Email))
		var found User
		for _, x := range a.state.Users {
			if x.Email == b.Email {
				found = x
			}
		}
		if path == "auth/register" {
			if !strings.Contains(b.Email, "@") || len(b.Name) < 2 || len(b.Password) < 8 || len(b.Password) > 72 {
				fail(w, 400, "Enter a name, valid email and password of 8–72 characters")
				return
			}
			if found.ID != "" {
				fail(w, 409, "Email already registered")
				return
			}
			h, _ := bcrypt.GenerateFromPassword([]byte(b.Password), bcrypt.DefaultCost)
			found = User{ID: id(), Name: b.Name, Email: b.Email, Role: "customer", PasswordHash: string(h)}
			a.state.Users[found.ID] = found
		} else if found.ID == "" || bcrypt.CompareHashAndPassword([]byte(found.PasswordHash), []byte(b.Password)) != nil {
			fail(w, 401, "Incorrect email or password")
			return
		}
		token := id() + id()
		a.state.Sessions[digest(token)] = Session{found.ID, time.Now().Add(7 * 24 * time.Hour)}
		a.commit(w, map[string]any{"user": publicUser(found), "token": token})
		return
	}
	if path == "products" && r.Method == "GET" {
		ps := []Product{}
		for _, p := range a.state.Products {
			ps = append(ps, p)
		}
		respond(w, 200, map[string]any{"products": ps})
		return
	}
	if path == "courses" && r.Method == "GET" {
		cs := []Course{}
		for _, c := range a.state.Courses {
			c.Lessons = nil
			cs = append(cs, c)
		}
		respond(w, 200, map[string]any{"courses": cs})
		return
	}
	if len(parts) == 2 && parts[0] == "products" && r.Method == "GET" {
		p, ok := a.state.Products[parts[1]]
		if !ok {
			fail(w, 404, "Product not found")
			return
		}
		respond(w, 200, map[string]any{"product": p})
		return
	}
	if len(parts) == 3 && parts[0] == "products" && parts[2] == "reviews" && r.Method == "GET" {
		reviews := a.state.Reviews[parts[1]]
		if reviews == nil {
			reviews = []Review{}
		}
		respond(w, 200, map[string]any{"reviews": reviews})
		return
	}
	if !authed && path != "checkout" {
		fail(w, 401, "Please sign in")
		return
	}
	switch path {
	case "auth/me":
		respond(w, 200, map[string]any{"user": publicUser(u)})
		return
	case "auth/logout":
		if r.Method != "POST" {
			fail(w, 405, "Use POST")
			return
		}
		delete(a.state.Sessions, digest(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")))
		a.commit(w, map[string]bool{"ok": true})
		return
	case "cart":
		if r.Method == "PUT" {
			var b struct {
				Items []Item `json:"items"`
			}
			if !decode(w, r, &b) {
				return
			}
			for _, i := range b.Items {
				if i.Quantity < 1 || i.Quantity > 100 {
					fail(w, 400, "Invalid quantity")
					return
				}
			}
			a.state.Carts[u.ID] = b.Items
			a.commit(w, map[string]any{"items": b.Items})
			return
		}
		items := a.state.Carts[u.ID]
		if items == nil {
			items = []Item{}
		}
		respond(w, 200, map[string]any{"items": items})
		return
	case "wishlist":
		if r.Method == "PUT" {
			var b struct {
				ProductIDs []string `json:"productIds"`
			}
			if !decode(w, r, &b) {
				return
			}
			for _, k := range b.ProductIDs {
				if _, ok := a.state.Products[k]; !ok {
					fail(w, 400, "Unknown product")
					return
				}
			}
			a.state.Wishlists[u.ID] = b.ProductIDs
			a.commit(w, map[string]any{"productIds": b.ProductIDs})
			return
		}
		ids := a.state.Wishlists[u.ID]
		if ids == nil {
			ids = []string{}
		}
		respond(w, 200, map[string]any{"productIds": ids})
		return
	case "orders":
		orders := []Order{}
		for _, o := range a.state.Orders {
			if o.UserID == u.ID {
				orders = append(orders, o)
			}
		}
		respond(w, 200, map[string]any{"orders": orders})
		return
	case "checkout":
		if r.Method != "POST" {
			fail(w, 405, "Use POST")
			return
		}
		var b struct {
			Items        []Item         `json:"items"`
			DiscountCode string         `json:"discountCode"`
			Address      map[string]any `json:"address"`
		}
		if !decode(w, r, &b) {
			return
		}
		items, total, discount, e := priceOrder(a.state.Products, b.Items, "")
		for _, field := range []string{"name", "phone", "city", "street", "postalCode"} {
			value, ok := b.Address[field].(string)
			if !ok || strings.TrimSpace(value) == "" || len(value) > 1000 {
				fail(w, 400, "Complete shipping address required: "+field)
				return
			}
		}
		if e != nil {
			fail(w, 400, e.Error())
			return
		}
		if b.DiscountCode != "" {
			d, ok := a.state.Discounts[strings.ToUpper(strings.TrimSpace(b.DiscountCode))]
			if !ok || !d.Active {
				fail(w, 400, "Invalid discount code")
				return
			}
			discount = total * d.Percent / 100
			total -= discount
		}
		shippingFee := a.state.Settings.ShippingFee
		if a.state.Settings.FreeShippingThreshold > 0 && total >= a.state.Settings.FreeShippingThreshold {
			shippingFee = 0
		}
		total += shippingFee
		guestToken := ""
		if !authed {
			u = User{ID: id(), Name: "Guest", Role: "guest"}
			a.state.Users[u.ID] = u
			guestToken = id() + id()
			a.state.Sessions[digest(guestToken)] = Session{u.ID, time.Now().Add(7 * 24 * time.Hour)}
		}
		o := Order{ID: id(), UserID: u.ID, Items: items, Total: total, Discount: discount, Status: "awaiting_payment", PaymentStatus: "unpaid", CreatedAt: time.Now().UTC().Format(time.RFC3339), Address: b.Address}
		o.ShippingFee = shippingFee
		a.state.Orders[o.ID] = o
		a.commit(w, map[string]any{"order": o, "token": guestToken})
		return
	case "payments/test":
		if r.Method != "POST" {
			fail(w, 405, "Use POST")
			return
		}
		var b struct {
			OrderID string `json:"orderId"`
		}
		if !decode(w, r, &b) {
			return
		}
		o, ok := a.state.Orders[b.OrderID]
		if !ok || o.UserID != u.ID {
			fail(w, 404, "Order not found")
			return
		}
		if o.PaymentStatus == "paid_test" {
			respond(w, 200, map[string]any{"order": o})
			return
		}
		if o.Status != "awaiting_payment" {
			fail(w, 409, "Order cannot be paid")
			return
		}
		for _, i := range o.Items {
			p, ok := a.state.Products[i.ProductID]
			if !ok || p.Stock < i.Quantity {
				fail(w, 409, "Product stock changed; please place a new order")
				return
			}
		}
		for _, i := range o.Items {
			p := a.state.Products[i.ProductID]
			p.Stock -= i.Quantity
			a.state.Products[p.ID] = p
		}
		o.PaymentStatus = "paid_test"
		o.Status = "processing"
		a.state.Orders[o.ID] = o
		a.state.Carts[u.ID] = []Item{}
		a.commit(w, map[string]any{"order": o, "test": true})
		return
	}
	if len(parts) == 3 && parts[0] == "products" && parts[2] == "reviews" && r.Method == "POST" {
		if _, ok := a.state.Products[parts[1]]; !ok {
			fail(w, 404, "Product not found")
			return
		}
		var b struct {
			Rating  int
			Comment string
		}
		if !decode(w, r, &b) {
			return
		}
		if b.Rating < 1 || b.Rating > 5 || len(b.Comment) < 3 || len(b.Comment) > 2000 {
			fail(w, 400, "Rating must be 1–5 and comment 3–2000 characters")
			return
		}
		for _, review := range a.state.Reviews[parts[1]] {
			if review.UserID == u.ID {
				fail(w, 409, "You already reviewed this product")
				return
			}
		}
		rv := Review{id(), u.ID, u.Name, b.Rating, b.Comment}
		a.state.Reviews[parts[1]] = append(a.state.Reviews[parts[1]], rv)
		p := a.state.Products[parts[1]]
		sum := 0
		for _, x := range a.state.Reviews[p.ID] {
			sum += x.Rating
		}
		p.Rating = float64(sum) / float64(len(a.state.Reviews[p.ID]))
		a.state.Products[p.ID] = p
		a.commit(w, map[string]any{"review": rv})
		return
	}
	if parts[0] == "admin" {
		if u.Role != "admin" {
			fail(w, 403, "Administrator access required")
			return
		}
		a.admin(w, r, parts)
		return
	}
	fail(w, 404, "Route not found")
}
func (a *App) admin(w http.ResponseWriter, r *http.Request, p []string) {
	if len(p) < 2 {
		fail(w, 404, "Route not found")
		return
	}
	key := ""
	if len(p) > 2 {
		key = p[2]
	}
	switch p[1] {
	case "uploads":
		a.uploadImage(w, r)
		return
	case "settings":
		if r.Method == "GET" {
			respond(w, 200, map[string]any{"settings": a.state.Settings})
			return
		}
		if r.Method != "PUT" {
			fail(w, 405, "Use PUT")
			return
		}
		var s Settings
		if !decode(w, r, &s) {
			return
		}
		if s.ShippingFee < 0 || s.FreeShippingThreshold < 0 {
			fail(w, 400, "Shipping amounts cannot be negative")
			return
		}
		a.state.Settings = s
		a.commit(w, map[string]any{"settings": s})
		return
	case "discounts":
		if r.Method == "GET" {
			ds := []Discount{}
			for _, d := range a.state.Discounts {
				ds = append(ds, d)
			}
			respond(w, 200, map[string]any{"discounts": ds})
			return
		}
		if r.Method == "DELETE" {
			delete(a.state.Discounts, strings.ToUpper(key))
			a.commit(w, map[string]bool{"ok": true})
			return
		}
		if r.Method != "POST" && r.Method != "PUT" {
			fail(w, 405, "Use POST or PUT")
			return
		}
		var d Discount
		if !decode(w, r, &d) {
			return
		}
		d.Code = strings.ToUpper(strings.TrimSpace(d.Code))
		if key != "" {
			d.Code = strings.ToUpper(key)
		}
		if d.Code == "" || len(d.Code) > 30 || d.Percent < 1 || d.Percent > 100 {
			fail(w, 400, "Code and percentage of 1–100 required")
			return
		}
		a.state.Discounts[d.Code] = d
		a.commit(w, map[string]any{"discount": d})
		return
	case "reviews":
		if r.Method == "GET" {
			respond(w, 200, map[string]any{"reviews": a.state.Reviews})
			return
		}
		if r.Method != "DELETE" || len(p) < 4 {
			fail(w, 405, "Use DELETE /admin/reviews/productId/reviewId")
			return
		}
		rs := a.state.Reviews[key]
		out := []Review{}
		for _, rv := range rs {
			if rv.ID != p[3] {
				out = append(out, rv)
			}
		}
		a.state.Reviews[key] = out
		if product, ok := a.state.Products[key]; ok {
			sum := 0
			for _, rv := range out {
				sum += rv.Rating
			}
			product.Rating = 0
			if len(out) > 0 {
				product.Rating = float64(sum) / float64(len(out))
			}
			a.state.Products[key] = product
		}
		a.commit(w, map[string]bool{"ok": true})
		return
	case "products":
		if r.Method == "GET" {
			items := []Product{}
			for _, x := range a.state.Products {
				items = append(items, x)
			}
			respond(w, 200, map[string]any{"products": items})
			return
		}
		if r.Method == "DELETE" {
			delete(a.state.Products, key)
			a.commit(w, map[string]bool{"ok": true})
			return
		}
		if r.Method != "POST" && r.Method != "PUT" {
			fail(w, 405, "Unsupported method")
			return
		}
		var x Product
		if !decode(w, r, &x) {
			return
		}
		if x.Name == "" || x.Price < 1 || x.Stock < 0 || x.Stock > 100000 || x.Price > 1000000000 {
			fail(w, 400, "Name, positive price and valid stock required")
			return
		}
		if key != "" {
			if _, ok := a.state.Products[key]; !ok {
				fail(w, 404, "Product not found")
				return
			}
			x.ID = key
		} else {
			x.ID = id()
		}
		if x.Slug == "" {
			x.Slug = x.ID
		}
		a.state.Products[x.ID] = x
		a.commit(w, map[string]any{"product": x})
		return
	case "courses":
		if r.Method == "GET" {
			items := []Course{}
			for _, x := range a.state.Courses {
				items = append(items, x)
			}
			respond(w, 200, map[string]any{"courses": items})
			return
		}
		if r.Method == "DELETE" {
			delete(a.state.Courses, key)
			a.commit(w, map[string]bool{"ok": true})
			return
		}
		if r.Method != "POST" && r.Method != "PUT" {
			fail(w, 405, "Use POST or PUT")
			return
		}
		var x Course
		if !decode(w, r, &x) {
			return
		}
		if x.Title == "" || x.Price < 0 {
			fail(w, 400, "Title and valid price required")
			return
		}
		for _, lesson := range x.Lessons {
			if strings.TrimSpace(lesson["title"]) == "" || strings.TrimSpace(lesson["content"]) == "" {
				fail(w, 400, "Each lesson requires title and content")
				return
			}
		}
		if key != "" {
			if _, ok := a.state.Courses[key]; !ok {
				fail(w, 404, "Course not found")
				return
			}
			x.ID = key
		} else {
			x.ID = id()
		}
		a.state.Courses[x.ID] = x
		a.commit(w, map[string]any{"course": x})
		return
	case "orders":
		if r.Method == "GET" {
			items := []Order{}
			for _, x := range a.state.Orders {
				items = append(items, x)
			}
			respond(w, 200, map[string]any{"orders": items})
			return
		}
		if r.Method != "PUT" {
			fail(w, 405, "Use PUT")
			return
		}
		o, ok := a.state.Orders[key]
		if !ok {
			fail(w, 404, "Order not found")
			return
		}
		var b struct{ Status string }
		if !decode(w, r, &b) {
			return
		}
		if b.Status != "processing" && b.Status != "shipped" && b.Status != "delivered" && b.Status != "cancelled" {
			fail(w, 400, "Invalid order status")
			return
		}
		if b.Status != "cancelled" && o.PaymentStatus != "paid_test" {
			fail(w, 409, "Only paid orders can be fulfilled")
			return
		}
		if b.Status == "cancelled" && o.Status != "cancelled" && o.PaymentStatus == "paid_test" {
			for _, i := range o.Items {
				if p, ok := a.state.Products[i.ProductID]; ok {
					p.Stock += i.Quantity
					a.state.Products[p.ID] = p
				}
			}
		}
		if o.Status == "cancelled" && b.Status != "cancelled" {
			fail(w, 409, "Cancelled orders cannot be reopened")
			return
		}
		o.Status = b.Status
		a.state.Orders[key] = o
		a.commit(w, map[string]any{"order": o})
		return
	}
	fail(w, 404, "Route not found")
}

// New initializes persistent storage. Production never falls back to local files.
func New(ctx context.Context) (*App, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn != "" && (len(os.Getenv("ADMIN_PASSWORD")) < 16 || os.Getenv("ADMIN_EMAIL") == "") {
		return nil, errors.New("set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 16 characters")
	}
	if dsn == "" && (os.Getenv("JUG_DEMO") != "true" || os.Getenv("VERCEL") != "") {
		return nil, errors.New("DATABASE_URL is required")
	}
	a := &App{state: initial()}
	if dsn != "" {
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			return nil, err
		}
		db.SetMaxOpenConns(3)
		db.SetMaxIdleConns(1)
		db.SetConnMaxLifetime(5 * time.Minute)
		a.db = db
		cleanup := func(err error) (*App, error) { db.Close(); return nil, err }
		if err = db.PingContext(ctx); err != nil {
			return cleanup(err)
		}
		if _, err = db.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS jug_state(id INTEGER PRIMARY KEY CHECK(id=1),data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"); err != nil {
			return cleanup(err)
		}
		data, _ := json.Marshal(a.state)
		if _, err = db.ExecContext(ctx, "INSERT INTO jug_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING", data); err != nil {
			return cleanup(err)
		}
	} else {
		a.demo = env("DEMO_DATA_PATH", "jug-demo.json")
		if data, err := os.ReadFile(a.demo); err == nil {
			if err = json.Unmarshal(data, &a.state); err != nil {
				return nil, err
			}
		} else if !os.IsNotExist(err) {
			return nil, err
		}
	}
	return a, nil
}
func Run() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	a, err := New(ctx)
	cancel()
	if err != nil {
		log.Fatal(err)
	}
	addr := env("API_ADDR", "127.0.0.1:8080")
	if port := os.Getenv("PORT"); port != "" {
		addr = "0.0.0.0:" + port
	}
	fmt.Println("JUG API listening on", addr)
	server := &http.Server{Addr: addr, Handler: a, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	log.Fatal(server.ListenAndServe())
}
