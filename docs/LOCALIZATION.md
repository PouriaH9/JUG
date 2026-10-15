# Persian and English

The website defaults to Persian (`fa`, RTL). The compact flag button in the header switches immediately between Persian and English (`en`, LTR), without resetting cart, forms, or lesson progress. The `jug-language` cookie remembers the selection for one year. The server reads the same cookie so reloads and direct links render the selected language from the first response.

`frontend/components/language.tsx` contains the provider, switch, and translation helper. `frontend/components/fa.json` maps original English copy to Persian, including the shipped product catalog, written lessons, and API errors. English remains the source text. Add new built-in copy and its Persian translation together. Unknown content is displayed unchanged; customer names, comments, and administrator-entered content are not machine-translated. Extend the dictionary when publishing new English catalog or lesson content that also needs a Persian version.

Language-specific layout and typography are scoped by `html[dir=rtl]` in `frontend/app/globals.css`. Persian uses Vazirmatn with Tahoma fallback. Currency uses the selected locale; amounts and the API's stored values are unchanged. Form option values, product IDs, lesson progress keys, and API status codes remain language independent.

Validation: TypeScript and a production build, plus browser checks of language switching and persistence, Persian lesson paragraphs/tasks, and mobile checkout layout.
