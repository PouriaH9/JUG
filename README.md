# JUG

This is the first working prototype, with sample products/prices and simulated payments. PostgreSQL runs locally at 127.0.0.1:54329. The storefront is http://127.0.0.1:3000.

## Start again

Run `./start-postgres.ps1` if PostgreSQL has stopped. Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 16 characters, then run `./start-local.ps1`. Alternatively, Docker Desktop users can run `docker compose up -d` and `./start-local.ps1`.

Use `./start-local.ps1 -Demo` only when you deliberately want local JSON storage instead of PostgreSQL.

Administrator credentials are set before the database is first initialized. Existing accounts are preserved on restart; changing environment variables does not reset an existing account.

## Review

Browse Shop, add a set or single ball, check out as guest or customer, apply FIRST10, then press Complete test payment. No bank information or real money is used. Customer accounts support saved wishlists, a cart and order history. Learn contains original written lessons with completion tasks. Admin manages products, orders, courses, discounts, reviews and shipping settings.

## Limits

Real payment integration, licensed video courses, email/SMS and final shipping/return/legal policies remain future work. The PostgreSQL storage uses a serialized JSONB state record with transaction locking across API instances. This is suitable for prototype review; high-volume commerce needs a normalized schema. See `backend/README.md`.

## Save and publish

From this folder, run `.\scripts\save-work.ps1 -Message "Describe your change"` to commit and push to [PouriaH9/JUG](https://github.com/PouriaH9/JUG). GitHub Actions runs the frontend build and backend checks.

The full application is live at [jug-liard.vercel.app](https://jug-liard.vercel.app) with Neon PostgreSQL and private image storage. Double-click `publish.cmd` to save, push and wait for publication. See [deployment instructions](docs/DEPLOYMENT.md) and [verified deployment status](docs/CLOUD-DEPLOYMENT-STATUS.md). After Vercel Git integration is connected, pushes to `main` publish the production site and pull requests receive preview deployments.
