# CLAUDE.md

This file gives any AI assistant (Claude Code, Codex, etc.) the context it needs to work productively in this repository.

## What this project is

**Track Expenses** (`accounting-pwa`) is a multi-user **group expense tracker** built as a PWA. Real users sign in with Google, then create or join a **group**. Inside a group, members log shared expenses, view analytics, and run a debt-settlement calculator. The app supports virtual (offline) members for trips with non-app users, and converts currencies at settlement time for trips abroad.

All shared state lives in **Firebase Realtime Database** under `/groups/<groupName>/`. There is no application backend — only Firebase Auth, Realtime DB, Hosting, and a single scheduled Cloud Function.

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Vue 3 (Options API in most pages) + Quasar v2 (PWA mode) |
| Build | Vite (via `@quasar/app-vite`) |
| State | Pinia (bootstrap only — no domain stores; pages subscribe directly to Firebase) |
| Backend | Firebase Auth (Google), Realtime Database, Hosting, Cloud Functions (Node 18) |
| Charts | ECharts 5 |
| Styling | Quasar components + Tailwind CSS (prefix `tw-`, dark mode via `class`) + SCSS |
| Date utils | dayjs |
| Linting | ESLint (airbnb-base + eslint-plugin-vue) |
| Tests | None configured (`npm test` is a no-op) |

## Commands

```bash
# Development
quasar dev          # Dev server at http://localhost:8180

# Production build (PWA)
quasar build        # Output: dist/spa/

# Lint
npm run lint        # ESLint (airbnb-base + vue plugin)

# Firebase Cloud Functions (run inside functions/)
cd functions && npm install
firebase deploy --only functions

# Hosting deploy
firebase deploy --only hosting
```

There is **no test suite**. `npm test` exits 0 immediately.

## Repository layout

```
accounting-pwa/
├── src/
│   ├── boot/                  # Quasar boot files (loaded before app start)
│   │   ├── firebase.js        # Initializes Firebase, exports auth/db + RTDB helpers
│   │   ├── axios.js           # Axios instance (currently unused)
│   │   └── darkMode.js        # Persists & syncs dark mode (Quasar Dark + html.dark class)
│   ├── pages/                 # Route components (one per screen)
│   │   ├── LogIn.vue
│   │   ├── IndexPage.vue
│   │   ├── ExpenseRecords.vue
│   │   ├── ExpenseAnalysis.vue
│   │   ├── SpendingResults.vue
│   │   ├── GroupMembers.vue
│   │   ├── GroupSetting.vue
│   │   └── ErrorNotFound.vue
│   ├── layouts/
│   │   └── MainLayout.vue     # Header (logout / dark toggle / avatar) + side drawer with group nav
│   ├── components/
│   │   ├── AlertDialog.vue    # Reusable confirm dialog
│   │   └── EssentialLink.vue
│   ├── router/
│   │   ├── index.js           # createRouter + onAuthStateChanged guard for meta.requiresAuth
│   │   └── routes.js          # Route table (see "Routing" below)
│   ├── stores/                # Pinia bootstrap only — no domain stores yet
│   ├── utils/
│   │   └── generateDate.js    # generateMonths(): last 12 months as { label, value }
│   ├── css/
│   │   ├── app.scss           # Global SCSS
│   │   ├── tailwind.css       # Tailwind entry (compiled by PostCSS)
│   │   └── quasar.variables.scss
│   ├── assets/                # Static assets imported by components
│   ├── api/                   # Reserved for future external API helpers
│   └── App.vue
├── src-pwa/                   # Quasar PWA mode files (service worker, manifest)
├── functions/
│   ├── index.js               # Scheduled Cloud Function: autoAddFixedExpenses
│   └── package.json
├── public/                    # Static files served as-is
├── quasar.config.js           # Boot list, css list, build target, PWA, devServer port 8180
├── tailwind.config.js         # prefix: 'tw-', darkMode: 'class'
├── postcss.config.cjs
├── firebase.json / .firebaserc
├── .env                       # Firebase credentials (VITE_ prefix; gitignored)
├── README.md                  # Project history in 中文 (feature changelog)
├── AGENTS.md                  # Mirror of this file for Codex
└── CLAUDE.md                  # This file
```

## Routing

`src/router/routes.js` defines a single layout (`MainLayout.vue`) with auth-protected children. All non-login routes carry `meta.requiresAuth: true`; the guard in `src/router/index.js` redirects unauthenticated visitors to `/login` via `onAuthStateChanged`.

| Path | Name | Component | Purpose |
|------|------|-----------|---------|
| `/` | `home` | `IndexPage.vue` | Pick or create a group |
| `/group/:groupName/records` | `records` | `ExpenseRecords.vue` | Per-month expense list, add/edit/delete |
| `/group/:groupName/analysis` | `analysis` | `ExpenseAnalysis.vue` | Category breakdown (pie + bar + table); custom date range |
| `/group/:groupName/settlement` | `settlement` | `SpendingResults.vue` | Debt-settlement calculator + currency conversion |
| `/group/:groupName/members` | `members` | `GroupMembers.vue` | Add/remove members (incl. virtual members) |
| `/group/:groupName/setting` | `setting` | `GroupSetting.vue` | Fixed-expense scheduler + custom expense categories |
| `/login` | `login` | `LogIn.vue` | Google OAuth entry point |
| `/:catchAll(.*)*` | — | `ErrorNotFound.vue` | 404 |

`groupName` is passed as a prop to each page (route `props: true`).

## Data flow

- **No Vuex/Pinia store for domain data.** Each page imports the helpers it needs directly from `src/boot/firebase.js` and wires its own `onValue` listeners. State is reactive and real-time.
- `src/boot/firebase.js` is the single source of truth for Firebase. It exports:
  - `auth`, `db`, `provider`, `signInWithPopup` (Auth)
  - `ref`, `set`, `get`, `update`, `onValue`, `child`, `remove`, `push` (Realtime Database)
- **All Firebase credentials come from Vite env vars** (see "Environment variables" below).
- `src/boot/axios.js` is wired up but currently unused for app data — kept for any future external API calls (e.g. exchange rates, OCR).

### Realtime Database shape

```
/groups/
  <groupName>/                        # Group key is the human-readable group name
    members/
      <memberId>: { id, name, email?, photoURL?, isVirtual? }
    expenses/
      <YYYY-MM>/                      # Bucketed by month
        <expenseId>: {
          id, description, amount,
          date,                       # ISO date YYYY-MM-DD
          payer: { label, value },
          members: [{ label, value }],   # who shares this expense
          type: { label, value, icon },  # category (default or custom)
          splitMethod?: 'equal' | 'shares' | 'exact' | 'percentage',
          splitDetails?: { <memberId>: number },  # shares / exact amount / percentage
        }
    groupSettings/
      fixedExpenses/
        <expenseId>: {
          name, amount,
          date: { label, value },     # day-of-month to auto-insert
          payerId: { label, value },
          installments: boolean,
          paymentTerms?: number,      # remaining installments; decremented monthly
        }
      customCategories/
        <categoryId>: { label, value, icon }
```

The exact shape evolves; treat the above as the current convention rather than a contract. Inspect `src/pages/*.vue` for authoritative reads/writes.

## Pages — what each one does

### `LogIn.vue`
Google OAuth via `signInWithPopup(auth, provider)`. On success, redirects to `/`. If a Firebase user exists but no record under `/users/<uid>`, it creates one.

### `IndexPage.vue`
Lists groups the current user belongs to. Lets the user **create a new group** (group name becomes the RTDB key) or **join an existing group** by name. Navigates to `/group/<name>/records` on selection.

### `ExpenseRecords.vue`
Per-month expense list with add/edit/delete dialog. Important details:
- Month picker uses `generateMonths()` (last 12 months).
- Dialog supports four **split methods** (`splitMethod` field on each expense):
  - `equal` — even split across selected members.
  - `shares` — each member gets N shares (default 1); amount split by ratio.
  - `exact` — each member's share is a fixed amount; sum must equal total.
  - `percentage` — each member's share is a percentage; sum must equal 100%.
- Validation prevents saving when share/exact/percentage totals don't reconcile.
- Writes are append-only via `push()` for new records; uses transactional `update()` for edits to avoid the **race condition** that previously affected concurrent writes.

### `ExpenseAnalysis.vue`
Reads expenses for a chosen month or custom date range and renders:
- Pie chart (category share)
- Bar chart (per-category totals)
- Table with all-category total row
- Custom-range mode for cross-month analysis

ECharts is used via `import * as echarts from 'echarts'`.

### `SpendingResults.vue`
Debt-settlement calculator:
- Aggregates everyone's paid-vs-owed across the selected period using each expense's `splitMethod`.
- Optionally applies a single **currency conversion** to the final settlement (not per-entry).
- Outputs a minimal set of "X owes Y $Z" transfers.

### `GroupMembers.vue`
List & manage group members. Supports adding **virtual members** (no Firebase account, used for non-app friends on trips). Removal of real members is intentionally disabled to preserve historical settlement integrity (see README).

### `GroupSetting.vue`
- **Fixed expenses**: name, amount, day-of-month, payer, optional installments. Persisted under `groupSettings/fixedExpenses` and consumed by the Cloud Function.
- **Custom categories**: arbitrary `{ label, value, icon }` records merged with built-in categories at display time across the app.

## Cloud Function

`functions/index.js` exports a single scheduled function:

- **`autoAddFixedExpenses`** — runs daily at `every day 10:30` in `Asia/Taipei`.
  1. Reads `/groups`.
  2. For each group's `fixedExpenses`, picks entries whose `date.value === today's day-of-month`.
  3. Inserts a synthesized expense (`type.value === 'fixed'`) into `/groups/<g>/expenses/<YYYY-MM>/`.
  4. If `installments === true`, decrements `paymentTerms`; deletes the fixed-expense entry when it hits 0.

Deploy with `firebase deploy --only functions` from inside `functions/`.

## Boot files (loaded by Quasar in this order)

`quasar.config.js` lists `boot: ['firebase', 'axios', 'darkMode']`.

- **`firebase.js`** — initializes Firebase, exports auth/db/RTDB helpers. Pages import directly from `src/boot/firebase.js`.
- **`axios.js`** — registers a global Axios instance (unused today; available for future external APIs).
- **`darkMode.js`** — on app start, restores dark-mode preference from `localStorage` (`accounting-pwa-dark-mode`), or falls back to `prefers-color-scheme: dark`. Calls `Dark.set()` from Quasar **and** toggles `html.dark` so Tailwind's `dark:` variants work in tandem with Quasar's `body--dark`. Exposes `setDarkMode` and `toggleDarkMode` helpers used by `MainLayout.vue`.

## Styling conventions

- **Tailwind utility classes are prefixed `tw-`** (e.g. `tw-flex`, `tw-rounded-md`). This avoids collisions with Quasar utility classes (`flex`, `q-pa-md`, etc.).
- Dark mode is **class-based** (`tailwind.config.js` → `darkMode: 'class'`). Always pair Tailwind dark variants with Quasar's auto-applied `body--dark` if you need both worlds.
- When adding new UI, audit dark-mode contrast — past sessions specifically fixed Group Members and Spending Results pages where `tw-bg-gray-100` text-on-light backgrounds became unreadable in dark mode.
- Quasar component classes and Tailwind utilities are freely mixed inside templates.

## Environment variables

All Firebase credentials are read from Vite env vars (must be prefixed `VITE_`). Create `.env` at the project root:

```
VITE_API_KEY=
VITE_AUTH_DOMAIN=
VITE_PROJECT_ID=
VITE_STORAGE_BUCKET=
VITE_MESSAGING_SENDER_ID=
VITE_APP_ID=
VITE_MEASUREMENT_ID=
VITE_DATABASE_URL=
```

`.env` is gitignored. The Cloud Function uses `firebase-admin` initialized without explicit credentials (relies on the deployed service account).

## Conventions / things to watch for when editing

- **Pages own their data subscriptions.** When adding a new page, mirror the existing pattern: `import { db, ref, onValue } from 'boot/firebase'` and clean up listeners in `beforeUnmount` if you start any.
- **Group key is the group name.** It appears in URLs and as the RTDB key. Avoid characters Firebase forbids in keys (`. # $ [ ]`).
- **Never mutate expense entries in place.** Read, build a new object, then `update()` or `set()` — this avoids the race condition that the recent "race error" fix addressed.
- **Default categories live in component code; custom categories live in RTDB.** Always merge both when displaying or filtering.
- **Currency is converted at settlement, not on entry.** If you add per-entry currency support, update `SpendingResults.vue` accordingly.
- **No tests.** When changing data flow, manually exercise: add expense → analysis → settlement → fixed-expense scheduler.
- The repo also contains an `AGENTS.md` aimed at Codex with the same content scope. Keep both files in sync when the architecture changes materially.
