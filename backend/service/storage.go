package service

import (
	"bytes"
	"context"
	"errors"
	_ "golang.org/x/image/webp"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

const maxImageSize = 5 << 20
const imageCache = "public, max-age=31536000, immutable"

var imageKeyPattern = regexp.MustCompile(`^products/[a-f0-9]{32}\.(png|jpg|webp)$`)

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
	endpoint := os.Getenv("AWS_ENDPOINT_URL_S3")
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("Neon object storage endpoint is not configured")
	}
	access, secret, region := os.Getenv("AWS_ACCESS_KEY_ID"), os.Getenv("AWS_SECRET_ACCESS_KEY"), os.Getenv("AWS_REGION")
	if access == "" || secret == "" || region == "" {
		return nil, errors.New("Neon object storage credentials are not configured")
	}
	client := s3.NewFromConfig(aws.Config{Region: region, Credentials: credentials.NewStaticCredentialsProvider(access, secret, ""), HTTPClient: &http.Client{Timeout: 20 * time.Second}}, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
	return &s3Store{client: client, bucket: "assets"}, nil
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
	data, err := io.ReadAll(io.LimitReader(result.Body, maxImageSize+1))
	if err != nil || len(data) > maxImageSize {
		return nil, "", errors.New("object exceeds image size limit")
	}
	return data, aws.ToString(result.ContentType), nil
}
func (s *s3Store) remove(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	return err
}
func imageType(data []byte) (string, string) {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 16384 || config.Height > 16384 {
		return "", ""
	}
	kind := http.DetectContentType(data)
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
	if r.Method != "POST" {
		fail(w, 405, "Use POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize+(64<<10))
	if err := r.ParseMultipartForm(maxImageSize); err != nil {
		fail(w, 413, "Upload one image of at most 5 MiB")
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
	data, err := io.ReadAll(io.LimitReader(file, maxImageSize+1))
	if err != nil || len(data) > maxImageSize {
		fail(w, 413, "Image must be at most 5 MiB")
		return
	}
	kind, extension := imageType(data)
	if extension == "" {
		fail(w, 415, "Use a PNG, JPEG or WebP image")
		return
	}
	storage, err := storageFromEnv()
	if err != nil {
		fail(w, 503, "Image storage unavailable")
		return
	}
	key := "products/" + id() + "." + extension
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
	data, _, err := storage.get(r.Context(), key)
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NoSuchKey" || apiErr.ErrorCode() == "NotFound") {
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
	if r.Method == "GET" {
		_, _ = w.Write(data)
	} else {
		w.WriteHeader(200)
	}
}
