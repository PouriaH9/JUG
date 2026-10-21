# Mobile performance pass — 2026-10-17

## Changes

- Removed the fixed 4.1-second introductory wait and body scroll lock. The menu and loading-state links work before the 3D module is ready.
- Display byte-based completion and remaining percentages below the three-dot loader. Each model has its own progress; 99% includes the final download/decoding stage, and the indicator disappears when that model is ready. Known uncompressed file sizes avoid incorrect percentages when HTTP compression changes Content-Length. Generic operations without a measurable total keep an indeterminate loader.
- Load the ball first. Load packaging after the entrance animation, or earlier when a close-up chapter is reached. Packaging has a separate Suspense boundary and cannot hold up the balls or navigation.
- Compressed geometry with Meshopt, conservatively simplified meshes, resized/compressed textures to WebP, and removed the unused packed-ball geometry. Originals are preserved.

| Model | Original bytes | Optimized bytes |
| --- | ---: | ---: |
| Ball | 2,637,540 | 740,044 |
| Packaging | 3,774,876 | 512,180 |
| Total | 6,412,416 | 1,252,224 |

This is an 80.5% reduction in the model files, not a measured reduction in total page transfer or loading time.

- Mobile canvas pixel ratio is capped at 1; desktop at 1.5. Mobile environment-map resolution is 128. Removed three repeated contact-shadow effects: desktop shares one, mobile uses the existing CSS floor.
- Pause WebGL off screen/in hidden tabs; render settled close-ups and packaging only on changes. Juggling and the rotating showcase continue animating.
- Mobile atmosphere uses 64 particles instead of 280, 3 fog layers instead of 7, 1 wisp instead of 3, and a 1x canvas. Disabled mobile full-screen blur/blend animations and grain.
- Mobile touch scrolling follows native momentum rather than triggering another forced scroll on touchend. Address-bar height changes no longer reset chapter position. The chapter arrow still works; desktop wheel chapter navigation remains available.

## Validation

- TypeScript check and production build passed.
- `node scripts/verify-performance.cjs`: progress isolation, monotonicity, compressed/missing length headers, readiness cap, asset byte-size consistency, self-contained compressed models, named cap and size budgets.
- `node scripts/verify-juggling.cjs`: 144 pattern handoffs, rapid input, mobile/desktop paths, and constant-gravity checks passed.
- Browser verification at 390 × 844: initial progress state, accessible navigation, optimized ball decoding, chapter transitions, packaging and inspection controls. This emulates layout; it is not a physical-phone GPU/FPS benchmark.
- Local API at port 8080 was not running. Product/account data behavior was not validated in this pass.
- No Vercel deployment, physical-phone profiling or before/after FPS claim is included.

## Regenerating assets

`frontend/scripts/optimize-models.mjs` rebuilds only the two optimized assets and `model-assets.json`. Run it with Node 20+ and a separate tool directory; do not add processing dependencies to the storefront's production bundle.

Tool versions used: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` 4.5.1; `meshoptimizer` 1.3.0; `sharp` 0.33.5. The tools' package.json pins `sharp` to 0.33.5 with an override so transitive copies match. Set `JUG_MODEL_TOOLS` to that directory, then run `node scripts/optimize-models.mjs` from the frontend. Run `node scripts/verify-performance.cjs` afterward and visually check the close-ups and packing sequence before shipping regenerated files.
