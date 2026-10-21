package service

import (
	"encoding/json"
	"golang.org/x/crypto/bcrypt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func request(a *App, method, path, body, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "/api/"+path, strings.NewReader(body))
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	return w
}
func testApp(t *testing.T) *App {
	t.Setenv("JUG_TEST_PAYMENTS", "true")
	return &App{state: initial(), demo: filepath.Join(t.TempDir(), "data.json")}
}
func login(t *testing.T, a *App, email, password string) string {
	t.Helper()
	w := request(a, "POST", "auth/login", `{"email":"`+email+`","password":"`+password+`"}`, "")
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var v struct{ Token string }
	json.Unmarshal(w.Body.Bytes(), &v)
	return v.Token
}
func TestServerPricesAndStock(t *testing.T) {
	s := initial()
	items, total, discount, e := priceOrder(s.Products, []Item{{ProductID: "ember-solo", Quantity: 2, Price: 1}}, "FIRST10")
	if e != nil || total != 810000 || discount != 90000 || items[0].Price != 450000 {
		t.Fatal(items, total, discount, e)
	}
	_, _, _, e = priceOrder(s.Products, []Item{{ProductID: "ember-solo", Quantity: 99}, {ProductID: "ember-solo", Quantity: 2}}, "")
	if e == nil {
		t.Fatal("duplicate lines bypassed stock")
	}
}
func TestAuthAndAdminAuthorization(t *testing.T) {
	a := testApp(t)
	w := request(a, "POST", "auth/register", `{"name":"Test User","email":"test@example.com","password":"securepassword","role":"admin"}`, "")
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var v struct {
		Token string
		User  User
	}
	json.Unmarshal(w.Body.Bytes(), &v)
	if v.User.Role != "customer" || strings.Contains(w.Body.String(), "passwordHash") {
		t.Fatal("unsafe registration")
	}
	if request(a, "GET", "admin/products", "", v.Token).Code != 403 {
		t.Fatal("customer accessed admin")
	}
	u := a.state.Users[v.User.ID]
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte("securepassword")) != nil {
		t.Fatal("password not hashed")
	}
	if request(a, "POST", "auth/login", `{"email":"test@example.com","password":"wrong"}`, "").Code != 401 {
		t.Fatal("bad password accepted")
	}
}
func TestPaymentOwnershipAndIdempotency(t *testing.T) {
	a := testApp(t)
	token := login(t, a, "admin@jug.local", "JugAdmin!2026")
	w := request(a, "POST", "checkout", `{"items":[{"productId":"ember-solo","quantity":2,"price":1}],"address":{"name":"Tester","phone":"09120000000","city":"Tehran","street":"Test street","postalCode":"1234567890"}}`, token)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var v struct{ Order Order }
	json.Unmarshal(w.Body.Bytes(), &v)
	if v.Order.Total != 900000 {
		t.Fatal("client price trusted")
	}
	if request(a, "POST", "payments/test", `{"orderId":"`+v.Order.ID+`"}`, "").Code != 401 {
		t.Fatal("anonymous payment accepted")
	}
	body := `{"orderId":"` + v.Order.ID + `"}`
	if request(a, "POST", "payments/test", body, token).Code != 200 {
		t.Fatal("payment failed")
	}
	if request(a, "POST", "payments/test", body, token).Code != 200 || a.state.Products["ember-solo"].Stock != 98 {
		t.Fatal("payment not idempotent")
	}
	if a.state.Orders[v.Order.ID].PaymentStatus != "paid_test" {
		t.Fatal("test payment mislabeled")
	}
}
func TestFailedPersistenceRollsBack(t *testing.T) {
	a := testApp(t)
	a.demo = filepath.Join(t.TempDir(), "missing", "data.json")
	w := request(a, "POST", "auth/register", `{"name":"Test User","email":"fail@example.com","password":"securepassword"}`, "")
	if w.Code != 503 || len(a.state.Users) != 1 {
		t.Fatal("failed save left mutated state")
	}
}
func TestGuestOwnershipDiscountShippingAndCancellation(t *testing.T) {
	a := testApp(t)
	a.state.Settings = Settings{ShippingFee: 50000, FreeShippingThreshold: 1000000}
	w := request(a, "POST", "checkout", `{"items":[{"productId":"ember-solo","quantity":2}],"discountCode":"FIRST10","address":{"name":"Tester","phone":"09120000000","city":"Tehran","street":"Test street","postalCode":"1234567890"}}`, "")
	var guest struct {
		Order Order
		Token string
	}
	json.Unmarshal(w.Body.Bytes(), &guest)
	if w.Code != 200 || guest.Token == "" || guest.Order.Total != 860000 {
		t.Fatal(w.Body.String())
	}
	admin := login(t, a, "admin@jug.local", "JugAdmin!2026")
	if request(a, "POST", "payments/test", `{"orderId":"`+guest.Order.ID+`"}`, admin).Code != 404 {
		t.Fatal("another user paid guest order")
	}
	request(a, "POST", "payments/test", `{"orderId":"`+guest.Order.ID+`"}`, guest.Token)
	request(a, "PUT", "admin/orders/"+guest.Order.ID, `{"status":"cancelled"}`, admin)
	request(a, "PUT", "admin/orders/"+guest.Order.ID, `{"status":"cancelled"}`, admin)
	if a.state.Products["ember-solo"].Stock != 100 {
		t.Fatal("cancellation inventory wrong")
	}
	request(a, "POST", "auth/logout", `{}`, guest.Token)
	if request(a, "GET", "orders", "", guest.Token).Code != 401 {
		t.Fatal("logout did not revoke token")
	}
}
func TestLoginRateLimitAndCourseContent(t *testing.T) {
	a := testApp(t)
	for i := 0; i < 20; i++ {
		request(a, "POST", "auth/login", `{"email":"nobody@example.com","password":"bad"}`, "")
	}
	if request(a, "POST", "auth/login", `{"email":"nobody@example.com","password":"bad"}`, "").Code != 429 {
		t.Fatal("missing rate limit")
	}
	for _, c := range a.state.Courses {
		if c.Price != 0 || len(c.Lessons) < 3 || len(c.Lessons[0]["content"]) < 100 || c.Lessons[0]["task"] == "" {
			t.Fatal("missing original free lessons")
		}
	}
}

func TestContactRequestValidationAndPersistence(t *testing.T) {
	a := testApp(t)
	for _, body := range []string{`{"phone":"bad","city":"Tehran"}`, `{"phone":"09123456789","city":" "}`} {
		if w := request(a, "POST", "contact-requests", body, ""); w.Code != 400 {
			t.Fatalf("invalid request accepted: %d", w.Code)
		}
	}
	w := request(a, "POST", "contact-requests", `{"phone":"09123456789","city":"Tehran"}`, "")
	if w.Code != 200 || len(a.state.ContactRequests) != 1 {
		t.Fatalf("save failed: %d", w.Code)
	}
	data, err := os.ReadFile(a.demo)
	if err != nil {
		t.Fatal(err)
	}
	var saved State
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatal(err)
	}
	if len(saved.ContactRequests) != 1 || saved.ContactRequests[0].City != "Tehran" {
		t.Fatal("contact was not persisted")
	}
}

func TestCallbackOrderLifecycle(t *testing.T) {
	a := testApp(t)
	body := `{"phone":"09123456789","city":"Tehran","items":[{"productId":"ember-set","quantity":2,"price":1}],"submissionId":"callback-test-reference-001"}`
	w := request(a, "POST", "contact-requests", body, "")
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var result struct{ Order Order }
	json.Unmarshal(w.Body.Bytes(), &result)
	o := result.Order
	if o.Source != "callback" || o.Total != 2580000 || o.Items[0].Name == "" || o.Address["phone"] != "09123456789" || o.Status != "received" {
		t.Fatal("missing order details", o)
	}
	request(a, "POST", "contact-requests", body, "")
	if len(a.state.Orders) != 1 {
		t.Fatal("retry created duplicate order")
	}
	if request(a, "GET", "admin/orders", "", "").Code < 400 {
		t.Fatal("public access to orders")
	}
	if request(a, "PUT", "admin/orders/"+o.ID, `{"status":"confirmed"}`, "").Code < 400 {
		t.Fatal("public status change")
	}
	admin := User{ID: "test-admin", Role: "admin", Email: "admin@example.test"}
	a.state.Users[admin.ID] = admin
	a.state.Sessions[digest("admin-test-token")] = Session{UserID: admin.ID, Expires: time.Now().Add(time.Hour)}
	for _, status := range []string{"contacting", "confirmed", "processing", "shipped", "delivered"} {
		w = request(a, "PUT", "admin/orders/"+o.ID, `{"status":"`+status+`"}`, "admin-test-token")
		if w.Code != 200 {
			t.Fatal(status, w.Code, w.Body.String())
		}
	}
	if request(a, "PUT", "admin/orders/"+o.ID, `{"status":"received"}`, "admin-test-token").Code != 409 {
		t.Fatal("terminal order reopened")
	}
	data, err := os.ReadFile(a.demo)
	if err != nil {
		t.Fatal(err)
	}
	var saved State
	json.Unmarshal(data, &saved)
	if saved.Orders[o.ID].Status != "delivered" || len(saved.Orders[o.ID].Progress) != 6 {
		t.Fatal("progress not persisted")
	}
	if saved.Products["ember-set"].Stock != 40 {
		t.Fatal("callback incorrectly altered payment inventory")
	}
	if request(a, "POST", "contact-requests", `{"phone":"09123456789","city":"Tehran","items":[{"productId":"missing","quantity":1}],"submissionId":"another-reference-001"}`, "").Code != 400 {
		t.Fatal("invalid item accepted")
	}
}
func TestPublicAdminNeda(t *testing.T) {
	a := testApp(t)
	for _, route := range []string{"products", "orders", "settings", "discounts", "reviews"} {
		if w := request(a, "GET", "adminneda/"+route, "", ""); w.Code != 200 {
			t.Fatalf("%s: %d %s", route, w.Code, w.Body.String())
		}
	}
	if w := request(a, "PUT", "adminneda/settings", `{"shippingFee":1234,"freeShippingThreshold":900000}`, ""); w.Code != 200 {
		t.Fatalf("public settings update: %d %s", w.Code, w.Body.String())
	}
	if w := request(a, "GET", "admin/products", "", ""); w.Code != 401 {
		t.Fatalf("legacy API should still require login: %d", w.Code)
	}
}
