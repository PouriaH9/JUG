# Protected phone preview

URL: https://aoicq-2a02-4540-ac-c2c3-2939-3f72-cbfe-40ec.free.pinggy.net

The preview gateway listens only on 127.0.0.1:3001 and proxies the production Next.js build on3002 and Go API on8080. A separate password gate protects both app pages and API endpoints. Passwords and temporary keys are stored only in the workspace work folder, outside the source deliverables.

Cloudflare was blocked by local network DNS. Localtunnel allocated a URL but failed external request verification. Pinggy SSH over443 successfully forwarded the protected gateway. Only this verified tunnel remains in use.

Verified: unauthenticated API401; password login secure cookie; authenticated home, shop, learn, API health/products and GLB200. The in-app browser blocks this tunnel domain, so actual phone-browser interaction is not verified. Pinggy may first show an Enter site screening page, followed by the JUG password page.

The free tunnel was created around18:26 Tehran on14October2026 and expires about19:26. It also requires the PC and the gateway/API/frontend processes to remain running. Restarting a free tunnel creates a new URL.

Runtime sessions: production frontend28659, protected gateway47899, SSH tunnel42857. Source: preview-gateway.mjs. API and database remain the earlier local services. No router ports, firewall rules or system DNS settings were changed.
