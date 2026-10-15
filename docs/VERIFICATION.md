# JUG verification — 14 October 2026

## Verified

- Go unit tests, build and vet passed. Tests cover password hashing, role boundaries, server-side totals, stock validation, payment ownership/idempotency, persistence rollback, guest checkout, shipping/discount behavior, validation and session logout.
- Real PostgreSQL 16 is running on loopback port 54329; the JUG database is UTF-8. The API health endpoint reports PostgreSQL storage.
- Data and session state survived an API process restart.
- Live API integration passed: guest checkout, FIRST10 server calculation, simulated payment, repeated payment without duplicate stock deduction, guest order history, customer wishlist/cart, written lessons and logout.
- Admin integration passed: product creation/edit/deletion, discount creation/edit/deletion, shipping configuration and review moderation. Temporary admin records were removed and shipping settings restored. The purchase verification order was cancelled to restore stock.
- HTTP checks returned 200 for /, /shop, /learn, /account, /admin, /checkout, /wishlist and the GLB asset. An unknown route correctly returned 404.
- Blender export and render completed successfully. The render was visually inspected; the GLB and editable Blender scene are included.

## Browser verification

Browser access recovered after the initial tooling failures. The desktop and 390-pixel mobile hero were visually inspected, with the actual Blender model rendering. Mobile navigation opened successfully. Through the storefront UI, a guest added a ball, submitted an address and FIRST10, refreshed the pending checkout, completed the simulated payment and saw the bag cleared. Course reading and completion marking worked. Administrator sign-in and the management dashboard worked. The desktop viewport was restored and a screenshot saved as preview.jpg.

The frontend production build and dependency audit passed; the final dependency audit reported zero vulnerabilities. These checks cover representative flows, not exhaustive accessibility, device, GPU or production security testing. Reduced-motion and GPU fallback paths still require dedicated browser verification.

## Local runtime

Frontend: http://127.0.0.1:3000
API: http://127.0.0.1:8080
PostgreSQL: 127.0.0.1:54329

The installed system Node 18 was too old for this Next.js build, so the bundled Node 24 runtime was used. Docker Desktop did not become ready; an official PostgreSQL portable distribution was downloaded into work and used instead. Docker Compose remains supplied for normal installation.

## Before commercial launch

Replace sample inventory/prices with actual products. Confirm language, shipping and legal policies; add actual gateway verification and production deployment/backup testing. Both starter courses are free original written lessons. Real video instruction and paid-course entitlements are not implemented. PostgreSQL state currently requires one Go API instance. Test checkout never transfers money.
