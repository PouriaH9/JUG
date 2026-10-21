# Deployment handoff — 16 October 2026

- Production: https://jug-liard.vercel.app
- Exact deployment: https://jug-8ikhb1sbu-pouriah9s-projects.vercel.app
- Vercel deployment ID: `dpl_G1VGzLatZaKSHZL4oH1NKHUFWhKb` — CLI returned `READY` and production alias succeeded.
- Local storefront: http://127.0.0.1:3000
- Local API: http://127.0.0.1:8080/api/health
- Local visual release atlas: http://127.0.0.1:3011
- Offline atlas: `docs/RELEASE-ATLAS.html`; detailed source map and backlog: `docs/RELEASE-REVIEW-2026-10-16.md`.

Both local and production health report PostgreSQL, `testPayments:false`, `checkoutAvailable:false`. Homepage, health and catalog HTTP checks passed locally; production homepage, shop, learn, health and catalog returned 200. The production build, backend tests/vet and juggling verification passed. Local homepage and existing production 3D rendering were visually inspected. Full acceptance across devices and account/commerce journeys is not yet complete.

The deployment used the existing linked Vercel project and its configured production environment. No provisioning or production credential changes were needed. It uploaded the working tree directly, including existing local application edits, without committing or pushing them. Review documents were created locally after the deployment upload and are not part of that deployment.

Local startup used the existing local PostgreSQL database. A temporary random administrator bootstrap value was supplied only in the child process environment; existing accounts were preserved. It was not saved or printed. Online checkout remains disabled. Local servers run for this session; restart later using `start-local.ps1` with your existing administrator environment, as described in README. The atlas can also be opened directly from its HTML file.

The local production verification used isolated `.next-release-review` output. Next.js added that ignored output's type path to the already modified TypeScript configuration. No application implementation was otherwise edited during this review.
