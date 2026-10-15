# Cloud deployment verification — 2026-10-15

Application repository: https://github.com/PouriaH9/JUG (branch `main`).

## Verified

- Initial application push: `b7ad8bbb253d8f25cee50224caacdfccac1e70e4`.
- GitHub Actions: https://github.com/PouriaH9/JUG/actions/runs/38734649378 — completed, success; frontend and backend jobs both succeeded.
- Root `npm run build`: exit 0. Next.js reported `Compiled successfully`, type validation passed, and `Generating static pages (10/10)` completed.
- Backend `go test ./...`: exit 0, `ok jug/backend/service`.
- Backend and root `go vet ./...`: exit 0.
- Root `go test ./...`: exit 0, Vercel API handler compiles.
- Storage tests exercise authenticated uploads, file limits and types, S3 request signing, path-style addressing, and a local upload/read roundtrip.
- Started the production frontend on `http://127.0.0.1:3008`. Browser checks confirmed the rendered 3D hero, live local catalog, shop navigation, adding a product to the cart, and Persian/English switching. This frontend used the existing local PostgreSQL-backed API on port 8080; it does not prove Neon connectivity.

## Cloud work pending authentication

- Installed Neon CLI 8.4.5 and Vercel CLI 64.2.0. They require a newer Node than the computer's default Node 18; commands were run using the bundled Node 24 runtime.
- Ran the requested `neon init -y --org-id org-lingering-cherry-24240663 --project-id winter-rice-30336144 --branch production --services postgres,object-storage`. It created `.neon`, `neon.ts`, and dependencies, but reported `linked, not verified`.
- `neon login` initially failed with `unexpected HTTP response status code`. Applying the existing Windows proxy to this command fixed OAuth discovery and opened the browser consent page. Browser authorization was not completed before its 60-second timeout.
- `neon deploy` has not succeeded. No Neon database URL or storage credentials were pulled. No live Neon database or storage test has passed.
- `vercel whoami` reported `Logged out`; `vercel login` opened its device authorization page and remained pending.
- A temporary deployment was attempted as a fallback, but Vercel rejected its token. No deployment URL was produced.
- Vercel project creation, Services framework setting, environment synchronization, Git integration, automatic deployments, and live-site tests remain pending. The committed workflow currently runs checks only.

## Complete after sign-in

Finish Vercel CLI authorization and run `neon login` with the newer Node runtime and the existing network proxy. Then run `scripts/deploy.ps1` from the application folder. Do not treat the configuration as a live deployment until that script succeeds and the returned URL passes browser/API checks.

The target configuration is a Vercel **Services** project: Next.js frontend and Go backend under one domain. Configure PostgreSQL and private object storage from Neon, and unique administrator credentials on the server. Previews must use isolated Neon credentials; do not silently reuse production data.

Checkout remains a simulated test payment flow.
