package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

const maxImageSize = 32 << 20
const maxMediaSize = 128 << 20
const imageCache = "public, max-age=31536000, immutable"

var chunkKeyPattern = regexp.MustCompile(`^products/[a-f0-9]{32}-[0-9]{1,2}\.chunk$`)
var uploadIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)
var imageKeyPattern = regexp.MustCompile(`^products/[a-f0-9]{32}(-full|-thumb)?\.(png|jpg|webp|mp4|webm)$`)

type objectStore interface {
	put(context.Context, string, []byte, string) error
	get(context.Context, string) ([]byte, string, error)
	remove(context.Context, string) error
}
type s3Store struct {
	client *s3.Client
	bucket string
}

func storageFromEnv() (objectStore, error) {
	// Explicit local development storage; never used by a deployed Vercel API.
	if directory := os.Getenv("JUG_LOCAL_MEDIA_DIR"); directory != "" && os.Getenv("VERCEL") == "" {
		root, err := filepath.Abs(directory)
		if err != nil {
			return nil, err
		}
		return &localImageStore{root: root}, nil
	}
	endpoint := os.Getenv("AWS_ENDPOINT_URL_S3")
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("Neon object storage endpoint is not configured")
	}
	access, secret, region := os.Getenv("AWS_ACCESS_KEY_ID"), os.Getenv("AWS_SECRET_ACCESS_KEY"), os.Getenv("AWS_REGION")
	if access == "" || secret == "" || region == "" {
		return nil, errors.New("Neon object storage credentials are not configured")
	}
	client := s3.NewFromConfig(aws.Config{Region: region, Credentials: credentials.NewStaticCredentialsProvider(access, secret, ""), HTTPClient: &http.Client{Timeout: 5 * time.Minute}}, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
	return &s3Store{client: client, bucket: "assets"}, nil
}

type localImageStore struct{ root string }

func (s *localImageStore) path(key string) (string, error) {
	if !imageKeyPattern.MatchString(key) && !chunkKeyPattern.MatchString(key) {
		return "", errors.New("invalid image key")
	}
	return filepath.Join(s.root, filepath.FromSlash(key)), nil
}
func (s *localImageStore) put(_ context.Context, key string, data []byte, _ string) error {
	path, err := s.path(key)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
func (s *localImageStore) get(_ context.Context, key string) ([]byte, string, error) {
	path, err := s.path(key)
	if err != nil {
		return nil, "", err
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, "", err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxMediaSize+1))
	if err != nil || len(data) > maxMediaSize {
		return nil, "", errors.New("invalid stored image")
	}
	if chunkKeyPattern.MatchString(key) {
		return data, "application/octet-stream", nil
	}
	kind, extension := imageType(data)
	if extension == "" {
		return nil, "", errors.New("invalid stored image")
	}
	return data, kind, nil
}
func (s *localImageStore) remove(_ context.Context, key string) error {
	path, err := s.path(key)
	if err != nil {
		return err
	}
	return os.Remove(path)
}
func (s *s3Store) put(ctx context.Context, key string, data []byte, kind string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key), Body: bytes.NewReader(data), ContentType: aws.String(kind), CacheControl: aws.String(imageCache)})
	return err
}
func (s *s3Store) get(ctx context.Context, key string) ([]byte, string, error) {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, "", err
	}
	defer result.Body.Close()
	data, err := io.ReadAll(io.LimitReader(result.Body, maxMediaSize+1))
	if err != nil || len(data) > maxMediaSize {
		return nil, "", errors.New("object exceeds image size limit")
	}
	return data, aws.ToString(result.ContentType), nil
}
func (s *s3Store) remove(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	return err
}
func imageType(data []byte) (string, string) {
	kind := http.DetectContentType(data)
	if kind == "video/mp4" {
		return kind, "mp4"
	}
	if kind == "video/webm" {
		return kind, "webm"
	}
	if len(data) > maxImageSize {
		return "", ""
	}

	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 16384 || config.Height > 16384 || int64(config.Width)*int64(config.Height) > 40000000 {
		return "", ""
	}
	kind = http.DetectContentType(data)
	switch kind {
	case "image/png":
		return kind, "png"
	case "image/jpeg":
		return kind, "jpg"
	case "image/webp":
		return kind, "webp"
	}
	return "", ""
}
func (a *App) uploadImage(w http.ResponseWriter, r *http.Request) {
	if r.Method == "DELETE" {
		upload := r.URL.Query().Get("upload")
		count, err := strconv.Atoi(r.URL.Query().Get("count"))
		if !uploadIDPattern.MatchString(upload) || err != nil || count < 1 || count > 43 {
			fail(w, 400, "Invalid upload")
			return
		}
		storage, err := storageFromEnv()
		if err != nil {
			fail(w, 503, "Media storage unavailable")
			return
		}
		for i := 0; i < count; i++ {
			_ = storage.remove(r.Context(), "products/"+upload+"-"+strconv.Itoa(i)+".chunk")
		}
		respond(w, 200, map[string]bool{"ok": true})
		return
	}

	if r.Method != "POST" {
		fail(w, 405, "Use POST or DELETE")
		return
	}

	chunked := r.URL.Query().Get("upload") != ""
	limit := int64(maxMediaSize)
	if chunked {
		limit = 3 << 20
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit+(64<<10))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		fail(w, 413, "Upload media of at most 128 MiB")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		fail(w, 400, "Provide an image in the file field")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxMediaSize+1))
	if err != nil || len(data) > maxMediaSize {
		fail(w, 413, "Media must be at most 128 MiB")
		return
	}

	storage, storageErr := storageFromEnv()
	if chunked {
		if storageErr != nil {
			fail(w, 503, "Media storage unavailable")
			return
		}
		upload := r.URL.Query().Get("upload")
		index, e1 := strconv.Atoi(r.URL.Query().Get("part"))
		count, e2 := strconv.Atoi(r.URL.Query().Get("count"))
		if !uploadIDPattern.MatchString(upload) || e1 != nil || e2 != nil || count < 1 || count > 43 || index < 0 || index >= count || len(data) > 3<<20 {
			fail(w, 400, "Invalid upload chunk")
			return
		}
		chunkKey := func(i int) string { return "products/" + upload + "-" + strconv.Itoa(i) + ".chunk" }
		if err = storage.put(r.Context(), chunkKey(index), data, "application/octet-stream"); err != nil {
			fail(w, 503, "Chunk upload failed")
			return
		}
		if index < count-1 {
			respond(w, 200, map[string]any{"part": index})
			return
		}
		defer func() {
			for i := 0; i < count; i++ {
				_ = storage.remove(r.Context(), chunkKey(i))
			}
		}()
		var assembled bytes.Buffer
		capacity := count * (3 << 20)
		if capacity > maxMediaSize {
			capacity = maxMediaSize
		}
		assembled.Grow(capacity)
		for i := 0; i < count; i++ {
			part, _, err := storage.get(r.Context(), chunkKey(i))
			if err != nil {
				fail(w, 400, "Missing upload chunk. Retry upload.")
				return
			}
			if assembled.Len()+len(part) > maxMediaSize {
				fail(w, 413, "Media must be at most 128 MiB")
				return
			}
			assembled.Write(part)
		}
		data = assembled.Bytes()
	}
	if len(data) > maxImageSize && !strings.HasPrefix(http.DetectContentType(data), "video/") {
		fail(w, 413, "Image must be at most 32 MiB")
		return
	}
	kind, extension := imageType(data)
	if extension == "" {
		fail(w, 415, "Use PNG, JPEG or WebP up to 32 MiB, or MP4 / WebM up to 128 MiB")
		return
	}
	if storageErr != nil {
		fail(w, 503, "Media storage unavailable")
		return
	}
	base := "products/" + id()
	key := base + "." + extension
	if strings.HasPrefix(kind, "image/") {
		original, _, decodeErr := image.Decode(bytes.NewReader(data))
		if decodeErr != nil {
			fail(w, 415, "Image is damaged")
			return
		}
		bounds := original.Bounds()
		width, height := bounds.Dx(), bounds.Dy()
		if width > 320 || height > 320 {
			if width >= height {
				height = height * 320 / width
				width = 320
			} else {
				width = width * 320 / height
				height = 320
			}
		}
		if width < 1 {
			width = 1
		}
		if height < 1 {
			height = 1
		}
		thumb := image.NewRGBA(image.Rect(0, 0, width, height))
		draw.CatmullRom.Scale(thumb, thumb.Bounds(), original, bounds, draw.Over, nil)
		var encoded bytes.Buffer
		if err := jpeg.Encode(&encoded, thumb, &jpeg.Options{Quality: 78}); err != nil {
			fail(w, 500, "Thumbnail creation failed")
			return
		}
		if err := storage.put(r.Context(), base+"-thumb.jpg", encoded.Bytes(), "image/jpeg"); err != nil {
			fail(w, 503, "Thumbnail storage unavailable")
			return
		}
		key = base + "-full." + extension
	}

	if err = storage.put(r.Context(), key, data, kind); err != nil {
		fail(w, 503, "Image storage unavailable")
		return
	}
	respond(w, 200, map[string]any{"key": key, "url": "/api/media/" + key, "contentType": kind, "size": len(data)})
}
func serveMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" && r.Method != "HEAD" {
		fail(w, 405, "Use GET or HEAD")
		return
	}
	key := strings.TrimPrefix(r.URL.Path, "/api/media/")
	if !imageKeyPattern.MatchString(key) {
		fail(w, 404, "Image not found")
		return
	}
	storage, err := storageFromEnv()
	if err != nil {
		fail(w, 503, "Image storage unavailable")
		return
	}

	if remote, ok := storage.(*s3Store); ok && os.Getenv("VERCEL") != "" {
		presigner := s3.NewPresignClient(remote.client)
		options := func(o *s3.PresignOptions) { o.Expires = 15 * time.Minute }
		signed, err := presigner.PresignGetObject(r.Context(), &s3.GetObjectInput{Bucket: aws.String(remote.bucket), Key: aws.String(key)}, options)
		if r.Method == "HEAD" {
			signed, err = presigner.PresignHeadObject(r.Context(), &s3.HeadObjectInput{Bucket: aws.String(remote.bucket), Key: aws.String(key)}, options)
		}
		if err != nil {
			fail(w, 503, "Media unavailable")
			return
		}

		w.Header().Set("Cache-Control", "private, no-store")
		http.Redirect(w, r, signed.URL, http.StatusTemporaryRedirect)
		return
	}
	data, _, err := storage.get(r.Context(), key)
	if err != nil {
		var apiErr smithy.APIError
		if os.IsNotExist(err) || (errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NoSuchKey" || apiErr.ErrorCode() == "NotFound")) {
			fail(w, 404, "Image not found")
			return
		}
		fail(w, 503, "Image storage unavailable")
		return
	}
	kind, _ := imageType(data)
	if kind == "" {
		fail(w, 404, "Image not found")
		return
	}
	w.Header().Set("Content-Type", kind)
	w.Header().Set("Cache-Control", imageCache)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, key, time.Time{}, bytes.NewReader(data))
}

// Read only the identity snapshot before consuming a potentially slow upload.
func (a *App) authorizeMediaUpload(w http.ResponseWriter, r *http.Request) bool {
	var user User
	var ok bool
	if a.db != nil {
		var raw []byte
		if err := a.db.QueryRowContext(r.Context(), "SELECT data FROM jug_state WHERE id=1").Scan(&raw); err != nil {
			fail(w, 503, "Storage unavailable")
			return false
		}
		var snapshot State
		if err := json.Unmarshal(raw, &snapshot); err != nil {
			fail(w, 503, "Storage unavailable")
			return false
		}
		identity := App{state: snapshot}
		user, ok = identity.user(r)
	} else {
		a.mu.Lock()
		user, ok = a.user(r)
		a.mu.Unlock()
	}
	if !ok {
		fail(w, 401, "Sign in required")
		return false
	}
	if user.Role != "admin" {
		fail(w, 403, "Administrator access required")
		return false
	}
	return true
}
