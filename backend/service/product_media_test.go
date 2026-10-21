package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"testing"
	"time"
)

func TestChunkedProductMediaAndRange(t *testing.T) {
	t.Setenv("JUG_LOCAL_MEDIA_DIR", t.TempDir())
	t.Setenv("VERCEL", "")
	a := testApp(t)
	token := login(t, a, "admin@jug.local", "JugAdmin!2026")
	send := func(path string, data []byte) *httptest.ResponseRecorder {
		t.Helper()
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		part, _ := form.CreateFormFile("file", "media")
		part.Write(data)
		form.Close()
		r := httptest.NewRequest("POST", "/api/admin/uploads"+path, &body)
		r.Header.Set("Content-Type", form.FormDataContentType())
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		a.ServeHTTP(w, r)
		return w
	}
	data := append(tinyPNG(), make([]byte, 5<<20)...)
	upload := "0123456789abcdef0123456789abcdef"
	var result struct {
		URL string `json:"url"`
		Key string `json:"key"`
	}
	for i, start := 0, 0; start < len(data); i, start = i+1, start+(3<<20) {
		end := start + (3 << 20)
		if end > len(data) {
			end = len(data)
		}
		w := send(fmt.Sprintf("?upload=%s&part=%d&count=2", upload, i), data[start:end])
		if w.Code != 200 {
			t.Fatalf("chunk: %d %s", w.Code, w.Body.String())
		}
		if end == len(data) {
			json.Unmarshal(w.Body.Bytes(), &result)
		}
	}
	w := request(a, "GET", result.URL[len("/api/"):], "", "")
	if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), data) {
		t.Fatal("large image round trip failed")
	}
	storage, _ := storageFromEnv()
	thumbKey := result.Key[:len(result.Key)-len("-full.png")] + "-thumb.jpg"
	_, kind, err := storage.get(context.Background(), thumbKey)
	if err != nil || kind != "image/jpeg" {
		t.Fatalf("thumbnail missing: %v", err)
	}
	if _, _, err := storage.get(context.Background(), "products/"+upload+"-0.chunk"); err == nil {
		t.Fatal("completed chunk not removed")
	}
	if got := request(a, "GET", "media/products/"+upload+"-0.chunk", "", ""); got.Code != 404 {
		t.Fatal("private chunk exposed")
	}
	video := append([]byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'm', 'p', '4', '2', 0, 0, 0, 0, 'm', 'p', '4', '2', 'i', 's', 'o', 'm'}, make([]byte, 1024)...)
	v := send("", video)
	if v.Code != 200 {
		t.Fatalf("video upload: %d %s", v.Code, v.Body.String())
	}
	json.Unmarshal(v.Body.Bytes(), &result)
	r := httptest.NewRequest("GET", result.URL, nil)
	r.Header.Set("Range", "bytes=0-23")
	response := httptest.NewRecorder()
	a.ServeHTTP(response, r)
	if response.Code != 206 || response.Body.Len() != 24 || response.Header().Get("Content-Type") != "video/mp4" {
		t.Fatalf("video range: %d", response.Code)
	}
	if got := send("?upload=invalid&part=0&count=2", []byte("x")); got.Code != 400 {
		t.Fatal("invalid ID accepted")
	}
	if got := send("?upload="+upload+"&part=1&count=2", []byte("x")); got.Code != 400 {
		t.Fatal("missing chunks accepted")
	}

	if got := send("?upload="+upload+"&part=0&count=2", []byte("partial")); got.Code != 200 {
		t.Fatal("partial upload failed")
	}
	if got := request(a, "DELETE", "admin/uploads?upload="+upload+"&count=2", "", token); got.Code != 200 {
		t.Fatalf("upload cleanup: %d", got.Code)
	}
	if _, _, err := storage.get(context.Background(), "products/"+upload+"-0.chunk"); err == nil {
		t.Fatal("cancelled chunk not removed")
	}
}

func TestSlowMediaUploadDoesNotBlockCatalog(t *testing.T) {
	t.Setenv("JUG_LOCAL_MEDIA_DIR", t.TempDir())
	t.Setenv("VERCEL", "")
	a := testApp(t)
	token := login(t, a, "admin@jug.local", "JugAdmin!2026")
	reader, writer := io.Pipe()
	defer writer.Close()
	defer reader.Close()
	r := httptest.NewRequest("POST", "/api/admin/uploads", reader)
	r.Header.Set("Authorization", "Bearer "+token)
	r.Header.Set("Content-Type", "multipart/form-data; boundary=slow")
	uploadDone := make(chan struct{})
	go func() { defer close(uploadDone); a.ServeHTTP(httptest.NewRecorder(), r) }()
	if _, err := writer.Write([]byte("--slow\r\n")); err != nil {
		t.Fatal(err)
	}
	catalogDone := make(chan int, 1)
	go func() { catalogDone <- request(a, "GET", "products", "", "").Code }()
	select {
	case status := <-catalogDone:
		if status != 200 {
			t.Fatalf("catalog: %d", status)
		}
	case <-time.After(time.Second):
		t.Fatal("catalog blocked by media upload")
	}
	writer.Close()
	select {
	case <-uploadDone:
	case <-time.After(time.Second):
		t.Fatal("upload did not terminate")
	}
}
