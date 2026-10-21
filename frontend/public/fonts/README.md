# JUG typography

- English display: Cormorant Garamond, variable weights 300–700 (Latin).
- Persian: Estedad, variable weights 100–900 (Arabic/Persian).
- Existing DM Sans remains the English interface/body face for small-size readability.

Both new faces are self-hosted WOFF2 files loaded through `next/font/local`.
Language changes automatically select the matching face. Preloading is disabled
so visitors only request a face when the page uses it.

Sources: Google Fonts (`google/fonts`, `ofl/cormorantgaramond` and `ofl/estedad`),
distributed as WOFF2 through Fontsource's variable-font CDN.
Both are licensed under the SIL Open Font License 1.1; full licenses are included.
