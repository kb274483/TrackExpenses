# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
quasar dev          # Start dev server at http://localhost:8180

# Build
quasar build        # Build PWA for production (output: dist/)

# Lint
npm run lint        # ESLint (airbnb-base + vue plugin)

# Firebase Functions (run inside functions/)
cd functions && npm install
firebase deploy --only functions
```

No test suite is configured (`npm test` exits immediately).

## Architecture

**Stack:** Vue 3 + Quasar v2 (PWA mode) + Vite + Pinia + Firebase (Auth, Realtime Database) + ECharts + Tailwind CSS

The app is a group expense tracker. Users sign in with Google, then join or create a **group**. All data is stored under `/groups/<groupId>/` in Firebase Realtime Database.

### Data flow

- `src/boot/firebase.js` — initializes Firebase and exports `auth`, `db`, and all Realtime Database helpers (`ref`, `set`, `get`, `update`, `onValue`, `child`, `remove`, `push`). Every page imports directly from here.
- `src/boot/axios.js` — Axios instance (currently unused for Firebase data; available for external APIs).
- There is no Vuex/Pinia store for app data — Firebase `onValue` listeners are wired up inside individual page components (reactive, real-time).
- `src/stores/` contains only the Pinia bootstrap; no domain stores exist yet.

### Pages

| Page | Route role |
|------|-----------|
| `LogIn.vue` | Google OAuth entry point |
| `IndexPage.vue` | Group selection (create / join) |
| `ExpenseRecords.vue` | Monthly expense list, add/edit/delete entries |
| `ExpenseAnalysis.vue` | ECharts pie/bar charts + table; supports custom date range |
| `SpendingResults.vue` | Debt settlement calculator with optional currency conversion |
| `GroupMembers.vue` | Member management (includes virtual/offline members) |
| `GroupSetting.vue` | Fixed-expense scheduler + custom expense categories |

### Key concepts

- **Virtual members** — members without a Firebase account; stored in group data and treated the same as real members in settlement calculations.
- **Fixed expenses** — configured in `GroupSetting`; a Firebase Cloud Function (`functions/index.js`) runs daily at 10:30 Asia/Taipei and auto-inserts them into the current month's records, decrementing installment counters when set.
- **Custom categories** — stored in group data and merged with default categories at display time.
- **Currency conversion** — applied at settlement time on `SpendingResults`, not per-entry.

### Environment variables

All Firebase credentials come from Vite env vars (prefix `VITE_`). Create a `.env` file at the project root:

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

### Routing & auth guard

`src/router/index.js` wraps `createRouter` and uses `onAuthStateChanged` in `beforeEach` to redirect unauthenticated users to `/login` for any route with `meta.requiresAuth`.

### Styling conventions

Components use **both** Quasar component classes and Tailwind utility classes (prefixed `tw-`). Tailwind config is in `tailwind.config.js`; the compiled CSS is imported as `tailwind.css` in `quasar.config.js`.
