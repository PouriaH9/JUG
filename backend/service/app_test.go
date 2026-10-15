package service

import (
	"encoding/json"
	"golang.org/x/crypto/bcrypt"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
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
