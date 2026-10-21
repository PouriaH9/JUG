# Performance implementation and agent review — 2026-10-17

## Decision

Implementation and local production-browser checks complete. **8.5/10 for implementation and local verification.** This is an engineering review score, not a Lighthouse score or measured mobile FPS. A physical phone and the deployed Vercel version remain unverified. No deployment or commit was made.

Three agents handled rendering, asset generation, and independent review. The parent integrated lightweight previews, image/font priorities, deferred decoration, regression fixes and runtime QA. Existing unrelated changes were preserved.

## Delivered

| Area | Result |
| --- | --- |
| Adaptive rendering | Two-second measurement windows after warmup, asymmetric thresholds and cooldown. Mobile DPR .65/.8/1; desktop .8/1/1.5. Sustained very slow visible frames force minimum quality, then static fallback if they continue. Demand/hidden frames are excluded. Sampling covers continuously animated opening chapters; later chapters inherit the selected tier. |
| Mobile geometry | 99,216-byte / 4,682-triangle juggling model, versus the 740,044-byte / 37,797-triangle detailed model. About 87% fewer bytes and 88% fewer triangles. |
| Desktop geometry | 315,216-byte / 14,974-triangle juggling model. |
| Details | 740,044-byte close-up model starts loading near the first showcase. The lightweight model remains visible until the shared load promise resolves. Packaging (512,180 bytes) loads near its chapter. |
| Materials and lighting | Cheaper mobile Standard materials preserve leather textures; fewer lights and no contact shadows on mobile. Lowest tier omits atmosphere. |
| Frame efficiency | Removed repeated position-array maps, object spreads and vector/quaternion allocations in the hot animation path. Shared juggling controller continues caching its per-frame result. Settled close-ups use demand rendering. |
| Progressive loading | Navigation and real HTML content paint first. Heavy 3D code is dynamic. Decorative atmosphere is a separate delayed import, skipped for reduced motion/Save-Data. |
| Fallback | CSS brown-ball preview needs no WebGL or canvas. Defaults to this preview for Save-Data, <=2 GB reported memory, or reduced motion unless the user explicitly chooses 3D. Manual mode choice persists. Render/model failures and real context loss switch to the usable preview. |
| Retry | Explicit retries clear failed model promises and progress while preserving loaded/pending resources. |
| Images | Responsive logo copies preserve alpha, reducing 512 px bytes 13.7% and 1024 px bytes 4.4%. Product images decode asynchronously and offscreen cards load lazily. |
| Fonts | Only the initial page language's local font is preloaded. Matching font-face URLs prevent duplicate font downloads; both faces retain swap behavior and support the static-preview base path. |
| Loading feedback | Per-asset byte progress and remaining percentages stay isolated across model variants; reserve the final percent until the scene is ready. Generic unmeasurable requests keep indeterminate dots. |

## Independent score

| Category | Score |
| --- | ---: |
| Mobile models and deferred detail | 9/10 |
| Adaptive rendering and frame efficiency | 8/10 |
| Lightweight fallback and retry | 9/10 |
| Loading, images and fonts | 8/10 |
| Runtime verification coverage | 7/10 |

The aggregate review judgment is 8.5/10; category scores are qualitative rather than a benchmark formula. Real-phone profiling is required before assigning a higher runtime score or claiming a particular FPS improvement.

## Verification and review fixes

- TypeScript and optimized production build passed. Initial route JavaScript remains approximately 183 KB before separately loaded 3D code; no large reduction in that initial bundle is claimed.
- `verify-performance.cjs`: asset size/geometry budgets, compatible scene bounds, per-variant progress, shared in-flight promises, decoded reuse and failed-download retry passed.
- `check-adaptive-quality.cjs`: downgrade/upgrade thresholds, tier bounds, cooldown, isolated gaps, repeated severe stalls, one-shot fallback and inactive safety passed.
- `check-preview-policy.cjs`: Save-Data, memory/reduced-motion defaults, unknown capability handling, invalid preferences and explicit overrides passed.
- `verify-juggling.cjs`: all 144 transitions, rapid input, depth lanes, catches, and 16,595 airborne gravity samples passed.
- Local production browser at 390 × 844 verified: navigation, mobile base model, switching to static removes all canvases, switching back restores 3D, detailed model switching, demand-rendered close-ups, stitching, packing and inspection controls.
- DOM inspection confirmed the Persian font is the only font preload on the Persian page.
- Runtime review caught and fixed a Canvas fallback component whose effect ran even when WebGL was supported. Context-loss listeners now clean up and ignore disconnected canvases, so deliberately leaving 3D does not report a GPU failure.
- Independent review found/fixed rejected-model retry caching and unsafe deferred swaps across separate React/3D render roots.

## Limits

The local backend at port 8080 was not running; commerce and account data paths were not validated here. No physical phone GPU profile, cold mobile-network benchmark, deployed cache audit or production Vercel validation was available. Browser layout emulation and policy tests cannot establish a real-phone FPS number.

`MOBILE-PERFORMANCE.md` describes the earlier first pass. This report supersedes its eager packaging, font-loading and model-selection details. Asset generation remains reproducible through `frontend/scripts/optimize-models.mjs`; originals are preserved.
