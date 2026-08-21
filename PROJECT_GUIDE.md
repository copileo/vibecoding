# Vibecode Hub: architecture and coding guide

## What this repository is

Vibecode Hub is a collection of independent, installable browser miniapps published as static files, typically through GitHub Pages. There is no framework, package manager, bundler, backend, or build step. HTML, CSS, JavaScript, SVG, manifests, and service workers are served exactly as committed.

The root app is only a catalog. Each folder under `apps/` is its own application and has its own URL, UI, storage, web app manifest, icon, and offline cache. A miniapp should continue to work when opened directly, without first visiting the hub.

## Repository map

```text
/
├── index.html                 # Hub/catalog UI
├── manifest.webmanifest       # Install metadata for the hub
├── icon.svg                   # Hub icon
├── sw.js                      # Hub offline cache
└── apps/
    ├── habitos/               # Daily habit tracker
    ├── despesas-viagem/       # Shared travel-expense calculator/report
    ├── cloud-ai-lab/          # Direct OpenAI/Anthropic API experiments
    ├── llm-offline/           # In-browser WebLLM/WebGPU experiments
    ├── cartas-tcg/            # Current, incrementally extended TCG app
    └── cartas-tcg-v2/         # Experimental modular rewrite (not in hub catalog)
```

Most small apps keep their markup, styles, state, and behavior in one `index.html`. Larger apps extract selected responsibilities into ordinary scripts. This is intentional: deployment stays copy-only and each app remains self-contained.

## Runtime flow

1. The browser opens the root `index.html` and sees links to miniapps.
2. The hub registers its own root-scoped service worker.
3. Opening a miniapp loads that folder's `index.html`; relative links such as `../../` return to the hub.
4. The miniapp restores browser-local state, binds DOM handlers, renders its current state, and registers its folder-scoped service worker.
5. The service worker precaches the app shell and applies either cache-first or network-first behavior, depending on the app.
6. All durable application data stays in the browser. Small JSON data uses `localStorage`; structured records and image `Blob`s use IndexedDB.

Because service-worker scope follows its directory, the hub and every miniapp can be installed and updated independently.

## How each app works

### Hub

The root page is a static grid of links. Adding an app requires adding its folder and manually adding a matching card to the grid. The root service worker caches only the hub shell and deliberately avoids deleting caches owned by known miniapps.

### Habits (`apps/habitos`)

This is the simplest reference implementation. It loads an array from the `vibecode-habitos-v1` local-storage key, keeps it in a `habits` variable, and follows the cycle:

```text
user event -> mutate state -> saveHabits() -> render()
```

A completion stores `lastCompleted` as an ISO date. On load, `done` is derived by comparing that date with today, which resets the visible daily state without a timer or background task.

### Travel expenses (`apps/despesas-viagem`)

The main state is one JSON object under `vibecode-trip-expenses-v1`:

```js
{ name, rate, members: [], expenses: [] }
```

Expenses reference members by ID and contain weighted shares (`memberId` plus `quota`). Rendering is split by feature (`renderMembers`, `renderShare`, `renderExpenses`, and `renderSummary`), while `renderAll` coordinates a complete refresh. Balance calculation determines what each person paid versus owed and derives settlement transfers.

`report-v2.js` extends report generation separately, drawing a shareable image to a canvas. The service worker can inject this script into a navigation response, so changes to that integration must be checked both online and from cache.

### Cloud AI Lab (`apps/cloud-ai-lab`)

This app calls the OpenAI Responses API or Anthropic Messages API directly from the browser. It normalizes the two provider responses into text, input tokens, output tokens, latency, and estimated cost. Benchmarks are data-driven arrays containing a category, prompt, and result-checking function.

API keys are held in the page unless the user opts to store them in local storage. There is no proxy: browser security, provider CORS support, API compatibility, and key exposure are part of this app's operating constraints. Model IDs and prices are hard-coded and therefore need deliberate maintenance.

### Offline LLM (`apps/llm-offline`)

This app dynamically imports WebLLM, checks for WebGPU, downloads a selected model, and runs independent chat completions locally. UI actions are guarded by `busy`; long benchmark loops use an `abort` flag. Provider output is normalized before exact or structured checks, and Qwen thinking blocks are separated from the final answer for display.

The app shell works offline after caching, but a model still needs to have been downloaded into browser-managed storage. The third-party module import and model assets are not part of this repository.

### TCG cards (`apps/cartas-tcg`)

This is the current, legacy-grown card editor. Its large `index.html` owns the original state and UI. Later scripts extend it through globals on `window`, DOM injection, event hooks, and wrappers around existing render functions.

Important layers include:

- `collection-layout.js`, `layout-workspace.js`, and `layout-fixes.js` for layout controls and UI organization.
- `template-front.svg` and `template-back.svg` as card templates with stable element IDs used as renderer slots.
- `template-renderer.js` for loading/cloning SVG templates and filling text, colors, and images.
- `template-customization.js` for collection/card-specific settings and IndexedDB updates.
- `svg-editor.js`, `print-svg.js`, and `template-print.js` for preview and A4 print preparation.
- `bootstrap-v150.js` as a compatibility bootstrap injected by the service worker when absent.

Script order matters because the extension scripts expect earlier globals and DOM nodes. Preserve public `window.__...` hooks and SVG element IDs unless all consumers are updated together. Object URLs made from stored image blobs are cached for reuse and revoked on `pagehide`.

### TCG cards v2 (`apps/cartas-tcg-v2`)

This is a cleaner experimental rewrite and is not linked from the root catalog. It uses small global modules, each wrapped in an IIFE:

- `db.js` exposes `window.TCGDB`, an IndexedDB adapter for `franchises`, `collections`, and `cards`.
- `renderer.js` exposes `window.TCGRenderer`, which builds SVG nodes programmatically and updates image/theme slots.
- `print.js` exposes `window.TCGPrint`, grouping rendered cards into pages of nine.
- `app.js` coordinates forms, relations, previews, persistence, and printing.

The data hierarchy is `franchise -> collection -> card`, connected by IDs. Shared visual settings belong to the highest useful scope: franchise logo/layout, collection backgrounds/theme, and card art/layout. The renderer consumes those three records as a context rather than reading storage itself. This separation is the preferred direction for new complex code.

## Coding patterns to follow

### Keep apps isolated and dependency-light

Use relative URLs and do not make one miniapp depend on another miniapp's runtime or cache. Prefer browser APIs and plain JavaScript. If an external dependency is unavoidable, make its loading/error state visible, as the offline LLM app does.

### Keep one source of truth

Load durable data into an in-memory state object or array. Event handlers should validate input, update that state, persist it, and call a render function. Avoid treating scattered DOM values as the durable model.

For larger domains, keep records normalized and relate them by stable IDs. Use `crypto.randomUUID()` with the existing time/random fallback when creating IDs.

### Separate persistence, domain logic, and rendering

Small pages may keep these in one file, but functions should still have clear roles:

- persistence: `load`, `save`, or a small database adapter;
- domain calculations: balances, relations, pricing, fitting, validation;
- rendering: `renderX` functions that derive UI from state;
- orchestration: initialization and event handlers.

Rendering modules should receive data rather than reach into IndexedDB. Persistence modules should not manipulate the DOM.

### Use browser-safe DOM output

Prefer `textContent`, `createElement`, and `replaceChildren` for user-provided values. Where HTML strings are used, escape dynamic values with the app's `esc` helper. Never insert API responses, names, notes, or imported data into `innerHTML` unescaped.

Use optional chaining and defensive defaults for data that may come from an older stored schema. Storage reads and JSON parsing should fail back to a valid empty state.

### Model asynchronous UI explicitly

Disable controls while an async operation is active, show useful progress/status text, use `try/catch/finally`, and restore controls in `finally`. Long sequential work should expose cancellation through an app-level flag. `requestAnimationFrame` is used in the v2 card preview to coalesce frequent slider updates.

### Preserve ownership of settings

Store a value at the scope where it is shared. In the TCG domain, for example, art framing is card-level, backgrounds/theme are collection-level, and a logo is franchise-level. Do not duplicate shared settings into every child record.

### Keep PWA metadata synchronized

Every installable app normally has:

- `index.html` with mobile/PWA metadata and service-worker registration;
- `manifest.webmanifest` with relative `start_url`, `scope`, colors, and icon;
- `icon.svg`;
- `sw.js` with an app-specific cache prefix and an explicit asset list.

When changing cached files, add new paths to `ASSETS` and bump the cache name/version. Otherwise an installed app may continue running stale code. Activation should delete only caches with that app's prefix; it must not delete sibling apps' caches.

Choose the fetch strategy intentionally:

- cache-first suits fully local app shells and fast offline startup;
- network-first suits pages where fresh HTML is important, with cached fallback;
- navigation rewriting/injection is specialized compatibility behavior and should not become the default.

### Treat versions and integration hooks as contracts

Some apps display a version and also use it in cache names or cache-busting query strings. Update all related values together. In the legacy TCG app, global hooks, script order, service-worker injection, and SVG IDs are integration contracts even though there is no type system enforcing them.

### Match the existing UI conventions

The apps are mobile-first, use `viewport-fit=cover`, safe-area padding, native system fonts, large touch targets, responsive grids, CSS custom properties, and dark themes. Controls use a minimum practical font size of 16px where mobile browser zoom would be disruptive. Keep labels, empty states, status messages, and accessible button names when adding interactions.

## Adding a new miniapp

1. Create `apps/<slug>/` with `index.html`, `manifest.webmanifest`, `icon.svg`, and `sw.js`.
2. Give its cache a unique prefix and list every local runtime asset in `ASSETS`.
3. Use only relative links; use `../../` for the hub link from a first-level app folder.
4. Give local-storage keys and IndexedDB names a `vibecode-<app>-...` namespace.
5. Register `./sw.js` from the page.
6. Add a card to the root `index.html` grid when the app is ready to expose.
7. Update `README.md` if the public app list or repository structure changes.
8. Test direct navigation, refresh, offline reload, installation metadata, persistence, and cache upgrade behavior.

## Local development and verification

Serve the repository over HTTP; opening files through `file://` does not accurately exercise service workers, manifests, module imports, or fetches.

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/`. There are currently no automated tests, lint configuration, or build commands, so verification is browser-based. For each change, check:

- the hub and changed app load with no console errors;
- direct URLs and back links work;
- create/update/delete flows survive a reload;
- unsafe-looking text is rendered as text, not markup;
- the app still loads offline after one successful online visit;
- an old cache upgrades after its version is bumped;
- responsive layout and print layout (where applicable) remain usable;
- API/WebGPU features show understandable failures when unavailable.

Use a private browser profile or clear only the specific app's storage/cache when testing a clean install. Avoid clearing all site data when another miniapp's local data needs to be preserved.

## Current architectural cautions

- The top-level README lists fewer apps than the hub currently exposes.
- Most source is compact and several apps are single-file, so unrelated formatting rewrites create noisy changes.
- Cloud model names and prices are snapshots, not dynamically sourced configuration.
- The legacy TCG app shares an older IndexedDB name with some extension scripts, while v2 uses `vibecode-cartas-tcg-v2-clean`; do not assume the two implementations share all data.
- Service workers can hide mistakes behind stale responses. A cache-version bump is part of a functional change whenever cached assets change.
- Browser-local data has no built-in synchronization or server backup. Schema changes should be backward-compatible or include an explicit migration.
