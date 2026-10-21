# JUG Go API

Go 1.24+ with PostgreSQL via pgx. All prices are integer **toman**, quantities are whole balls/sets. Only simulated payments are supported. `paid_test` is never a real paid transaction.

## Run

```powershell
$env:DATABASE_URL = 'postgres://jug:jug_local_dev@localhost:5432/jug?sslmode=disable'
$env:ADMIN_EMAIL = 'your-admin@example.com'
$env:ADMIN_PASSWORD = 'replace-with-a-unique-long-password'
go run .
```

The URL above is an example; use the credentials from the root compose configuration. On first startup the API creates `jug_state`, inserts seed data if absent, and reloads saved state. No database means startup fails unless demo mode is explicitly enabled:

```powershell
$env:JUG_DEMO = 'true'
$env:DEMO_DATA_PATH = 'jug-demo.json'
go run .
```

Default listener: `127.0.0.1:8080`. Set `API_ADDR` to change it; hosted runtimes can set `PORT`, which binds on `0.0.0.0`. Set `FRONTEND_ORIGIN` for a different frontend (default `http://localhost:3000`). Demo persistence uses atomic replacement of a local JSON file. `/api/health` reports `postgresql` or `demo-json`.

Demo seed admin: `admin@jug.local` / `JugAdmin!2026`. PostgreSQL mode requires an explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD` of at least 16 characters; known default credentials are never implicitly enabled there. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` **before the first initialization** to replace demo credentials. Existing records are never overwritten at startup. Login and registration share a limit of 20 attempts per five minutes per remote IP. This is a local prototype; use private deployment and review authentication before exposing it publicly.

## API

JSON requests and responses. Errors: `{ "error": "message" }`. Authenticated requests send `Authorization: Bearer <token>`. Passwords are bcrypt hashed, session tokens are cryptographically random, only their SHA-256 digests are persisted, and sessions expire after seven days. User responses exclude password hashes.

| Method | Route | Body / response |
|---|---|---|
| GET | `/api/health` | `{status,storage,testPayments}` |
| GET | `/api/products` | `{products: Product[]}` |
| GET | `/api/products/{id}` | `{product}` |
| GET | `/api/courses` | `{courses: Course[]}` (no lessons) |
| GET | `/api/courses/{id}` | `{course}` with educational lessons |
| GET | `/api/settings` | `{settings:{shippingFee,freeShippingThreshold}}` |
| POST | `/api/auth/register` | `{name,email,password}` → `{user,token}` |
| POST | `/api/auth/login` | `{email,password}` → `{user,token}` |
| GET | `/api/auth/me` | `{user}` |
| POST | `/api/auth/logout` | Invalidates current token |
| GET / PUT | `/api/cart` | `{items:[{productId,quantity}]}` |
| GET / PUT | `/api/wishlist` | `{productIds:string[]}` |
| POST | `/api/checkout` | `{items,discountCode?,address}` → `{order,token}` |
| POST | `/api/payments/test` | `{orderId}` → `{order,test:true}` |
| GET | `/api/orders` | `{orders}` belonging to current account/token |
| GET / POST | `/api/products/{id}/reviews` | GET `{reviews}`; POST `{rating,comment}` |

Checkout accepts guests and requires nonempty string address fields `name`, `phone`, `city`, `street`, `postalCode`. An anonymous checkout returns a new guest `token`; keep it for order lookup and test payment. Authenticated checkout returns an empty token field and keeps the existing bearer token. Checkout always calculates prices on the server and merges duplicate items before checking stock. Payment rechecks current stock, reduces it once, clears cart, and is idempotent. No live gateway or money transfer occurs. `FIRST10` initially discounts merchandise by 10%; shipping is applied afterward. Shipping defaults to zero until configured.

Administrator routes require a user with `role: admin`:

| Method | Route | Body / response |
|---|---|---|
| GET / POST | `/api/admin/products` | GET `{products}`; POST Product → `{product}` |
| PUT / DELETE | `/api/admin/products/{id}` | PUT full Product → `{product}` |
| GET | `/api/admin/orders` | `{orders}` for all users |
| PUT | `/api/admin/orders/{id}` | `{status}`: processing / shipped / delivered / cancelled |
| GET / POST | `/api/admin/courses` | GET `{courses}`; POST Course → `{course}` |
| PUT / DELETE | `/api/admin/courses/{id}` | PUT full Course → `{course}` |
| GET / POST | `/api/admin/discounts` | GET `{discounts}`; POST `{code,percent,active}` |
| PUT / DELETE | `/api/admin/discounts/{code}` | PUT `{percent,active}` |
| GET / PUT | `/api/admin/settings` | `{shippingFee,freeShippingThreshold}` |
| GET | `/api/admin/reviews` | `{reviews:{productId:Review[]}}` |
| DELETE | `/api/admin/reviews/{productId}/{reviewId}` | Removes review and recalculates rating |

Cancellation restores inventory once for a simulated paid order. Cancelled orders cannot be reopened. Only paid test orders can be fulfilled.

## Data and validation

Product: `id,name,slug,description,price,category,color,weight,stock,image,featured,rating`. Course: `id,title,description,level,duration,price,image,lessons`. Lessons have `title,content,task,url`. Two free courses provide seven original written practice lessons; no video assets or paid course entitlements are claimed. Prices and stock are seed examples for review. Admin product updates replace the full record. Product IDs remain stable.

The prototype persists application state in one PostgreSQL JSONB row. A mutex serializes operations within **one API instance**. Run only one instance; multi-instance deployment requires normalized tables or transaction-level locking, migrations, database-backed rate limits, and further production review. Save failures roll back in-memory changes and return 503. Do not enable demo mode as an automatic fallback for production.

```powershell
go test ./...
go vet ./...
```

Tests cover password hashing, registration privilege escalation, protected admin access, server-side totals, duplicate stock checks, idempotent test payments, guest ownership, shipping and discounts, cancellation inventory, logout, login throttling, authored lessons, and rollback on persistence errors. Live PostgreSQL verification additionally confirmed saved wishlist and session survival across an actual API process restart.

## Hosting and concurrency

The local entrypoint (`main.go`) and Vercel API entrypoint (`../api/index.go`) share `service`. PostgreSQL requests use a transaction-scoped advisory lock and reload committed state for every request. Responses are buffered until the transaction commits; errors roll back changes. This protects the prototype JSON state against lost updates across concurrent serverless instances. Neon pooled connection URLs work with the transaction-scoped lock. The API uses pgx through database/sql with a small connection pool. Vercel cannot use JSON demo persistence.

Run `go test ./...` and `go vet ./...` from this directory. To explicitly verify two application instances against PostgreSQL, set `JUG_TEST_DATABASE_URL` to a test database and run `go test ./service -run TestPostgresInstancesShareState -v`. The test creates a temporary customer, checks cross-instance session access and concurrent cart/wishlist persistence, and removes that customer.

## Neon product image storage

Declare private bucket `assets` in `neon.ts`, run `neon deploy`, then provide the injected `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION` to the backend host. AWS SDK v2 sends signed path-style S3 requests. Credentials never enter browser responses. Shipped assets remain static website files.

Administrators can `POST /api/admin/uploads` with a bearer token and `multipart/form-data` field `file`: PNG, JPEG or WebP up to 32 MiB (maximum dimension 16384 pixels and 40 megapixels), or MP4 / WebM up to 128 MiB. The result is `{key,url,contentType,size}`. Save `url` in a product's `image` field. Each upload has a fresh random key. `GET /api/media/products/<generated-key>` serves only this public product-image namespace from the private bucket with immutable caching. Failed configuration or credentials return 503.

Set `JUG_TEST_OBJECT_STORAGE=true` with provisioned AWS environment variables and run `go test ./service -run TestNeonStorageRoundTrip -v` to verify a real upload, read, image proxy and cleanup. Unit tests verify SigV4 signing, path-style addressing, authorization, upload size/type restrictions and unconfigured-storage failures.

## Product editor and local media

The temporary public admin page is `/adminneda`, with matching `/api/adminneda/*` management routes. Product copy supports `nameFa`, `nameEn`, `descriptionFa`, `descriptionEn`, `subtitleFa`, and `subtitleEn`. Legacy `name` and `description` remain available and mirror the English values when supplied. Existing products fall back to their original copy and dictionary translations until edited. Updates preserve the product ID, slug, and review rating.

The ordered `images` list has at most 12 entries; `image` is the first cover image. The editor previews the actual storefront card and detail components in either language and supports selecting multiple files, choosing a cover, reordering, and removing entries. Price must be a positive whole number in toman, stock 0–100000, and ball weight 1–10000 grams. The category determines whether the box contains one or three balls.

`start-local.ps1` sets `JUG_LOCAL_MEDIA_DIR` to `backend/.local-media` unless already configured. Uploaded media persists in this ignored directory across local API restarts and is served through `/api/media/`. Back up this directory alongside product data when using local storage. Vercel always uses the configured cloud storage; it never falls back to local disk. Cloud credentials must be repaired before deploying products that use local uploads, and those media files must be transferred to cloud storage.


Product media uploads use sequential multipart pieces of at most 3 MiB with `?upload=<random-32-hex>&part=<zero-based>&count=<1..43>`. All pieces use the existing admin upload authorization. The final request validates and assembles the file, creates a 320px JPEG thumbnail for images, persists the media and removes the pieces. DELETE with upload and count removes interrupted pieces; the client calls it after an upload error. Configure an object-storage lifecycle rule to expire `products/*-*.chunk` after one day for browser crashes or lost connections. Do not expire completed product media. Uploaded image keys end in `-full.ext`; their thumbnail ends in `-thumb.jpg`. Existing URLs remain valid. Videos are detected by file content; no transcoding is performed, so use browser-compatible MP4/H.264 or WebM codecs.

On Vercel, public media routes redirect to a short-lived signed storage download URL, allowing storage to deliver large files and byte ranges directly. Local media supports HTTP Range and HEAD for video seeking. Remote storage delivery must be verified in the deployment environment; local tests do not establish deployment readiness.
