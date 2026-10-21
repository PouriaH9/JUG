package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

// Exercises the deployed HTTP routes, authentication and private storage together.
func TestDeployedAPIStorageRoundTrip(t *testing.T) {
	base := strings.TrimRight(os.Getenv("JUG_TEST_API_URL"), "/")
	if base == "" {
		t.Skip("JUG_TEST_API_URL is not configured")
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.RawQuery != "" || parsed.User != nil {
		t.Fatal("configure an HTTPS deployment origin")
	}
	email, password := os.Getenv("ADMIN_EMAIL"), os.Getenv("ADMIN_PASSWORD")
	if email == "" || password == "" {
		t.Fatal("administrator environment is not configured")
	}
	storage, err := storageFromEnv()
	if err != nil {
		t.Fatal("storage cleanup environment is not configured")
	}
	client := &http.Client{Timeout: 45 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	credentials, _ := json.Marshal(map[string]string{"email": email, "password": password})
	req, _ := http.NewRequestWithContext(ctx, "POST", base+"/api/auth/login", bytes.NewReader(credentials))
	req.Header.Set("Content-Type", "application/json")
	response, err := client.Do(req)
	if err != nil {
		t.Fatal("deployed login request failed")
	}
	var login struct{ Token string }
	decodeErr := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&login)
	response.Body.Close()
	if response.StatusCode != 200 || decodeErr != nil || login.Token == "" {
		t.Fatalf("deployed login failed: HTTP %d", response.StatusCode)
	}
	t.Log("Deployed administrator login: HTTP 200")
	t.Cleanup(func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		req, _ := http.NewRequestWithContext(cleanup, "POST", base+"/api/auth/logout", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+login.Token)
		response, err := client.Do(req)
		if err != nil {
			t.Error("test-session logout request failed")
			return
		}
		defer response.Body.Close()
		if response.StatusCode != 200 {
			t.Errorf("test-session logout failed: HTTP %d", response.StatusCode)
		} else {
			t.Log("Temporary test session logged out")
		}
	})
	data := tinyPNG()
	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	part, _ := writer.CreateFormFile("file", "smoke-test.png")
	_, _ = part.Write(data)
	_ = writer.Close()
	req, _ = http.NewRequestWithContext(ctx, "POST", base+"/api/admin/uploads", &form)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+login.Token)
	response, err = client.Do(req)
	if err != nil {
		t.Fatal("deployed multipart upload request failed")
	}
	var upload struct {
		Key         string
		URL         string
		ContentType string
		Size        int
	}
	decodeErr = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&upload)
	response.Body.Close()
	if response.StatusCode != 200 || decodeErr != nil {
		t.Fatalf("deployed upload failed: HTTP %d", response.StatusCode)
	}
	if !imageKeyPattern.MatchString(upload.Key) {
		t.Fatal("upload returned an unexpected storage key")
	}
	t.Cleanup(func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := storage.remove(cleanup, upload.Key); err != nil {
			t.Error("generated image cleanup failed")
		} else {
			t.Log("Generated smoke-test image deleted")
		}
		if strings.Contains(upload.Key, "-full.") {
			thumbnail := strings.Split(upload.Key, "-full.")[0] + "-thumb.jpg"
			if err := storage.remove(cleanup, thumbnail); err != nil {
				t.Error("generated thumbnail cleanup failed")
			}
		}
	})
	if upload.URL != "/api/media/"+upload.Key || upload.ContentType != "image/png" || upload.Size != len(data) {
		t.Fatal("upload metadata did not match the test image")
	}
	t.Log("Deployed authenticated multipart image upload: HTTP 200")
	req, _ = http.NewRequestWithContext(ctx, "GET", base+upload.URL, nil)
	response, err = client.Do(req)
	if err != nil {
		t.Fatal("deployed public media request failed")
	}
	defer response.Body.Close()
	actual, err := io.ReadAll(io.LimitReader(response.Body, maxImageSize+1))
	if response.StatusCode != 200 || err != nil || !bytes.Equal(actual, data) {
		t.Fatalf("deployed media byte verification failed: HTTP %d", response.StatusCode)
	}
	if response.Header.Get("Content-Type") != "image/png" || response.Header.Get("Cache-Control") != imageCache {
		t.Fatal("deployed media content/cache headers did not match")
	}
	t.Log("Deployed public image: HTTP 200, exact bytes and immutable cache verified")
}
