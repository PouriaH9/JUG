package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// Opt-in release check. Only its uniquely identified records are cleaned up.
func TestDeployedProductAndCallbackOrder(t *testing.T) {
	base := strings.TrimRight(os.Getenv("JUG_TEST_API_URL"), "/")
	if base == "" || os.Getenv("JUG_TEST_RELEASE") != "true" {
		t.Skip("release verification is not enabled")
	}
	app, err := New(context.Background())
	if err != nil {
		t.Fatal("database connection failed")
	}
	t.Cleanup(func() { app.db.Close() })
	store, err := storageFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Timeout: 90 * time.Second}
	reference := "release-" + id()
	productID := ""
	keys := []string{}
	t.Cleanup(func() {
		for _, key := range keys {
			if err := store.remove(context.Background(), key); err != nil {
				t.Error("test media cleanup failed")
			}
		}
		tx, err := app.db.Begin()
		if err != nil {
			t.Error(err)
			return
		}
		defer tx.Rollback()
		if _, err = tx.Exec(`SELECT pg_advisory_xact_lock(74192026)`); err != nil {
			t.Error(err)
			return
		}
		var raw []byte
		if err = tx.QueryRow(`SELECT data FROM jug_state WHERE id=1`).Scan(&raw); err != nil {
			t.Error(err)
			return
		}
		var state State
		if err = json.Unmarshal(raw, &state); err != nil {
			t.Error(err)
			return
		}
		delete(state.Products, productID)
		for key, order := range state.Orders {
			if order.Address["submissionId"] == reference {
				delete(state.Orders, key)
			}
		}
		raw, _ = json.Marshal(state)
		if _, err = tx.Exec(`UPDATE jug_state SET data=$1 WHERE id=1`, raw); err != nil {
			t.Error(err)
			return
		}
		if err = tx.Commit(); err != nil {
			t.Error(err)
		}
	})
	call := func(method, path string, body any) map[string]json.RawMessage {
		t.Helper()
		var reader io.Reader
		if body != nil {
			data, _ := json.Marshal(body)
			reader = bytes.NewReader(data)
		}
		req, _ := http.NewRequest(method, base+path, reader)
		req.Header.Set("Content-Type", "application/json")
		response, err := client.Do(req)
		if err != nil {
			t.Fatal("API request failed", method, path)
		}
		defer response.Body.Close()
		if response.StatusCode != 200 {
			t.Fatalf("%s %s: HTTP %d", method, path, response.StatusCode)
		}
		var result map[string]json.RawMessage
		if err = json.NewDecoder(response.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	// Exercise the actual Vercel-safe, multipart chunk path with a file over 4 MB.
	image := append(tinyPNG(), make([]byte, 5<<20)...)
	uploadID := id()
	var mediaURL string
	for part, start := 0, 0; start < len(image); part, start = part+1, start+(3<<20) {
		end := start + (3 << 20)
		if end > len(image) {
			end = len(image)
		}
		var form bytes.Buffer
		writer := multipart.NewWriter(&form)
		file, _ := writer.CreateFormFile("file", "release.png")
		file.Write(image[start:end])
		writer.Close()
		req, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/adminneda/uploads?upload=%s&part=%d&count=2", base, uploadID, part), &form)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		response, err := client.Do(req)
		if err != nil {
			t.Fatal("chunk upload failed")
		}
		var result struct{ Key, URL string }
		json.NewDecoder(response.Body).Decode(&result)
		response.Body.Close()
		if response.StatusCode != 200 {
			t.Fatalf("upload part %d: HTTP %d", part, response.StatusCode)
		}
		if result.Key != "" {
			keys = append(keys, result.Key, strings.TrimSuffix(result.Key, "-full.png")+"-thumb.jpg")
			mediaURL = result.URL
		}
	}
	if mediaURL == "" {
		t.Fatal("upload did not finish")
	}
	response, err := client.Get(base + mediaURL)
	if err != nil {
		t.Fatal("public media failed")
	}
	actual, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.StatusCode != 200 || !bytes.Equal(actual, image) {
		t.Fatalf("media readback failed: HTTP %d", response.StatusCode)
	}
	t.Log("5 MB chunked upload and byte-exact public readback passed")
	p := Product{Name: reference, NameEn: reference, NameFa: "محصول آزمایشی", Description: "Release verification", DescriptionEn: "Release verification", DescriptionFa: "تست انتشار", Category: "solo", Price: 123000, Stock: 3, Weight: 120, Color: "#df5d26", Image: mediaURL, Images: []string{mediaURL}}
	result := call("POST", "/api/adminneda/products", p)
	json.Unmarshal(result["product"], &p)
	productID = p.ID
	if productID == "" {
		t.Fatal("missing product ID")
	}
	p.Price = 125000
	call("PUT", "/api/adminneda/products/"+productID, p)
	result = call("GET", "/api/products/"+productID, nil)
	var reopened Product
	json.Unmarshal(result["product"], &reopened)
	if reopened.Price != 125000 || reopened.NameFa != p.NameFa || reopened.Image != mediaURL {
		t.Fatal("product persistence failed")
	}
	body := map[string]any{"phone": "09000000000", "city": "Release QA", "items": []map[string]any{{"productId": productID, "quantity": 2, "price": 1}}, "submissionId": reference}
	result = call("POST", "/api/contact-requests", body)
	var order Order
	json.Unmarshal(result["order"], &order)
	if order.ID == "" || order.Total != 250000 || order.Status != "received" {
		t.Fatal("order creation or server pricing failed")
	}
	result = call("POST", "/api/contact-requests", body)
	var retry Order
	json.Unmarshal(result["order"], &retry)
	if retry.ID != order.ID {
		t.Fatal("retry duplicated order")
	}
	call("PUT", "/api/adminneda/orders/"+order.ID, map[string]string{"status": "contacting"})
	result = call("GET", "/api/adminneda/orders", nil)
	var orders []Order
	json.Unmarshal(result["orders"], &orders)
	found := false
	for _, saved := range orders {
		if saved.ID == order.ID {
			found = saved.Status == "contacting" && len(saved.Progress) == 2
		}
	}
	if !found {
		t.Fatal("admin order persistence failed")
	}
	t.Log("Product create/edit/readback and callback order create/retry/admin status passed")
	call("DELETE", "/api/adminneda/products/"+productID, nil)
}
