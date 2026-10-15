package service

import (
	"bytes"
	"context"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func tinyPNG() []byte {
	var data bytes.Buffer
	_ = png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 1, 1)))
	return data.Bytes()
}
func uploadRequest(a *App, data []byte, token string) *httptest.ResponseRecorder {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "upload.png")
	_, _ = part.Write(data)
	_ = writer.Close()
	r := httptest.NewRequest("POST", "/api/admin/uploads", &body)
	r.Header.Set("Content-Type", writer.FormDataContentType())
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	return w
}
func TestImageUploadsRequireAdminAndValidImages(t *testing.T) {
	a := testApp(t)
	if got := uploadRequest(a, tinyPNG(), ""); got.Code != 401 {
		t.Fatalf("anonymous upload: %d", got.Code)
	}
	token := login(t, a, "admin@jug.local", "JugAdmin!2026")
	if got := uploadRequest(a, []byte("<svg onload=alert(1)></svg>"), token); got.Code != 415 {
		t.Fatalf("unsafe upload accepted: %d", got.Code)
	}
	if got := uploadRequest(a, bytes.Repeat([]byte("x"), maxImageSize+1), token); got.Code != 413 {
		t.Fatalf("oversized upload accepted: %d", got.Code)
	}
	t.Setenv("AWS_ENDPOINT_URL_S3", "")
	if got := uploadRequest(a, tinyPNG(), token); got.Code != 503 {
		t.Fatalf("unconfigured storage claimed success: %d", got.Code)
	}
	for _, key := range []string{"../private.png", "products/file.svg", "secrets/token", "products/invalid.png"} {
		if got := request(a, "GET", "media/"+key, "", ""); got.Code != 404 {
			t.Errorf("unsafe media key accepted %q: %d", key, got.Code)
		}
	}
}
func TestS3RequestsUsePathStyleAndSigning(t *testing.T) {
	data := tinyPNG()
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/assets/products/test.png" {
			t.Errorf("expected path style bucket URL: %s", r.URL.Path)
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 ") {
			t.Error("object request was not SigV4 signed")
		}
		switch r.Method {
		case "PUT":
			_, _ = io.Copy(io.Discard, r.Body)
		case "GET":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(data)
		case "DELETE":
			w.WriteHeader(204)
		default:
			t.Errorf("unexpected method %s", r.Method)
		}
	}))
	defer server.Close()
	client := s3.NewFromConfig(aws.Config{Region: "us-east-2", Credentials: credentials.NewStaticCredentialsProvider("test-key", "test-secret", "")}, func(o *s3.Options) { o.BaseEndpoint = aws.String(server.URL); o.UsePathStyle = true })
	store := &s3Store{client: client, bucket: "assets"}
	if err := store.put(context.Background(), "products/test.png", data, "image/png"); err != nil {
		t.Fatal(err)
	}
	got, kind, err := store.get(context.Background(), "products/test.png")
	if err != nil || !bytes.Equal(got, data) || kind != "image/png" {
		t.Fatal("object round trip failed", err)
	}
	if err = store.remove(context.Background(), "products/test.png"); err != nil {
		t.Fatal(err)
	}
	if calls != 3 {
		t.Fatalf("expected upload/read/delete, got %d", calls)
	}
}
func TestNeonStorageRoundTrip(t *testing.T) {
	if os.Getenv("JUG_TEST_OBJECT_STORAGE") != "true" {
		t.Skip("JUG_TEST_OBJECT_STORAGE is not enabled")
	}
	storage, err := storageFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	key := "products/" + id() + ".png"
	data := tinyPNG()
	if err = storage.put(ctx, key, data, "image/png"); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := storage.remove(cleanup, key); err != nil {
			t.Errorf("test object cleanup failed: %v", err)
		}
	}()
	got, kind, err := storage.get(ctx, key)
	if err != nil || !bytes.Equal(got, data) || kind != "image/png" {
		t.Fatal("Neon object round trip failed", err)
	}
	w := httptest.NewRecorder()
	serveMedia(w, httptest.NewRequest("GET", "/api/media/"+key, nil))
	if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), data) || w.Header().Get("Cache-Control") != imageCache {
		t.Fatalf("public image proxy failed: %d", w.Code)
	}
}
