# JUG cloud deployment — verified 15 October 2026

Production website: https://jug-liard.vercel.app

Frontend fallback: https://pouriah9.github.io/JUG/

## Deployment

The full Next.js frontend and Go backend are deployed together in Vercel project `pouriah9s-projects/jug` using Services. The project is connected to `PouriaH9/JUG`; production uses `main`. The initial CLI deployment reached READY, and its public domain returned HTTP 200 without requiring Vercel sign-in.

Neon project `winter-rice-30336144`, branch `production`, supplies PostgreSQL and the private `assets` bucket. Credentials are kept in ignored `.env.local` and Vercel Production variables. Administrator credentials are generated once and are not committed.

## Passed checks

- `npm run build`: compiled successfully, TypeScript checks passed, 10/10 pages generated.
- `node frontend/scripts/verify-juggling.cjs`: all 144 pattern handoffs, rapid input, shared-frame stability, catches and releases passed.
- Live PostgreSQL test: sessions work across two independent API instances and concurrent cart/wishlist updates persist. Temporary test user cleaned up.
- Live Neon object-storage test: upload, byte-exact readback, media proxy, caching and cleanup passed.
- Live Vercel test `TestDeployedAPIStorageRoundTrip`: administrator login 200; authenticated multipart image upload 200; public media 200 with exact bytes, immutable caching and `nosniff`. Generated image removed and temporary session logged out.
- Public `/`, `/api/health`, `/api/products` and GLB model returned 200. Health reports PostgreSQL; catalog contains four seeded products.
- Browser checks confirmed the 3D homepage, navigation and real catalog on the Vercel domain.

## Resolved setup issues

Neon access from this computer requires its existing network proxy; direct requests initially returned 403. The proxy is applied only to relevant local processes. Both live Neon tests pass through it.

The first Git-triggered Vercel build failed while obtaining Go VCS metadata in the service build directory. Production and Preview now set `GOFLAGS=-buildvcs=false`; Go stamping is unnecessary for this build. The initial CLI build succeeded. Publish waiting distinguishes Git deployments from CLI deployments and tracks the exact pushed commit.

The Vercel project API does not accept `nodeVersion` during project creation; the deployment script was corrected. Authentication and provisioning are complete.

## Save and publish

Double-click `publish.cmd`, or run `scripts/publish.ps1` with a descriptive message. It commits and pushes application changes, follows GitHub checks and Pages publication, and waits for the same commit's Vercel Git deployment. Failures are shown instead of reporting an older deployment as successful. Files must be pushed; editor saves alone do not publish.

Checkout payments remain simulated. No customer orders or real payment transactions were created during deployment verification. Preview database credentials remain separate from Production; full backend previews require an isolated Neon branch before use.
