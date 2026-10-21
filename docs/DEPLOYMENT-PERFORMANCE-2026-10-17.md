# Performance deployment — 17 October 2026

- Public production URL: https://jug-liard.vercel.app
- Exact deployment: https://jug-7blvael2c-pouriah9s-projects.vercel.app
- Deployment ID: `dpl_6kgv1672v7hEu92kPjpzFep1KqEA`
- Vercel CLI reported `READY`; production alias succeeded.

Uploaded the existing working tree directly to the already linked `jug` project using its existing production configuration. No commit, push, environment-variable update, credential change or provisioning was performed. This local report was written after upload.

The remote Next.js and Go service builds succeeded. Local backend tests and vet passed before deployment. The public homepage returned HTTP 200 and contains the new lightweight preview. Public health returned `status:ok`, `checkoutAvailable:false`, `testPayments:false`.

Downloaded the public mobile and desktop model files and compared SHA-256 hashes with the local verified assets: both matched. Mobile model: 99,216 bytes. Desktop model: 315,216 bytes. The public production domain is reachable without the Vercel login required by the exact deployment URL's protection policy.

The live page was inspected in the browser. Physical-phone FPS and mobile-network performance remain to be tested on the user's phone.
