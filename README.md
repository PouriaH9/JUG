# JUG local review

This is the first working prototype, with sample products/prices and simulated payments. PostgreSQL runs locally at 127.0.0.1:54329. The storefront is http://127.0.0.1:3000.

## Start again

Run `./start-postgres.ps1` if PostgreSQL has stopped. Set `$env:ADMIN_PASSWORD = 'JugAdmin!2026'` for this local seed, then `./start-local.ps1`. Alternatively, Docker Desktop users can run `docker compose up -d` and `./start-local.ps1`.

Use `./start-local.ps1 -Demo` only when you deliberately want local JSON storage instead of PostgreSQL.

Admin: admin@jug.local / JugAdmin!2026. These credentials are only for reviewing this local prototype.

## Review

Browse Shop, add a set or single ball, check out as guest or customer, apply FIRST10, then press Complete test payment. No bank information or real money is used. Customer accounts support saved wishlists, a cart and order history. Learn contains original written lessons with completion tasks. Admin manages products, orders, courses, discounts, reviews and shipping settings.

## Limits

Real payment integration, licensed video courses, production hosting, email/SMS and final shipping/return/legal policies remain future work. Run one Go API instance: its first-version PostgreSQL storage uses a serialized JSONB state record. See docs/IMPLEMENTATION-NOTES.md and backend/README.md.
