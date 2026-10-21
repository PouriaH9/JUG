# JUG release verification — 21 October 2026

Production: https://jug-liard.vercel.app/

Admin: https://jug-liard.vercel.app/adminneda

Application release commit: `cab114a638e8b17ff9f40410661e8c651520f8ff`.
Vercel deployment `dpl_2g6RntkKtPTVGwcZizyhRw4e5u3q` reached READY. GitHub Application checks and Publish frontend preview both succeeded for that commit.

## Verified

- Combined frontend production build, backend tests and vet passed.
- Animation, adaptive quality and preview policy checks passed.
- Live Neon PostgreSQL cross-instance session and concurrent cart/wishlist persistence passed; temporary user cleaned up.
- Refreshed existing Neon storage credentials and updated Vercel Production storage variables. Local cloud upload/readback passed.
- Live Vercel admin login, multipart upload, byte-exact media readback and cache headers passed. Temporary session, image and thumbnail cleaned up.
- Live 5 MB image uploaded in two Vercel-safe pieces and downloaded byte-exactly through the public media endpoint.
- Live product create, price edit, bilingual text and image readback passed.
- Live callback order submission, server pricing, retry deduplication, admin order lookup and status progress persistence passed.
- Temporary release product, order, image and thumbnail cleaned up using only their unique IDs.
- Browser verified production catalog, product detail, add-to-bag, cart, checkout field validation, admin catalog and bilingual editor at the available mobile viewport.

## Presentation behavior

Customers add products to their bag, enter their phone and city, and submit an order for a callback. Admin receives the order and can update its progress. This flow works with real database persistence. It does not charge a bank card; real payment processing remains unconfigured.

`/adminneda` intentionally opens without a password, matching the requested admin behavior. The existing authenticated `/api/admin/` routes still require admin login.

Local media and QA screenshots are excluded from Vercel upload. Secrets remain in ignored environment files and Vercel settings.

## Repeat release verification

The opt-in backend tests `TestDeployedAPIStorageRoundTrip` and `TestDeployedProductAndCallbackOrder` require the existing cloud service environment, `JUG_TEST_API_URL=https://jug-liard.vercel.app`, and `JUG_TEST_RELEASE=true` for the latter. They make disposable live records and clean up their own artifacts. Never enable these tests implicitly in normal CI.
