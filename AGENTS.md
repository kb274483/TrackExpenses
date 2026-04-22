# AGENTS.md

This file gives any AI assistant working in this repository the context it needs to work productively.

## What this project is

**Track Expenses** (`accounting-pwa`) is a multi-user **group expense tracker** built as a PWA. Real users sign in with Google, then create or join a **group**. Inside a group, members log shared expenses, view analytics, and run a debt-settlement calculator. The app supports virtual (offline) members for trips with non-app users, and converts currencies at settlement time for trips abroad.

All shared state lives in **Firebase Realtime Database** under `/groups/<groupName>/`. There is no application backend today beyond Firebase services and a scheduled Cloud Function.

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Vue 3 + Quasar v2 (PWA mode) |
| Build | Vite via `@quasar/app-vite` |
| State | Pinia bootstrap only; pages subscribe directly to Firebase |
| Backend | Firebase Auth (Google), Realtime Database, Hosting, Cloud Functions (Node 18) |
| Charts | ECharts 5 |
| Styling | Quasar components + Tailwind CSS (`tw-` prefix) + SCSS |
| Date utils | dayjs |
| Linting | ESLint (`airbnb-base` + `eslint-plugin-vue`) |
| Tests | None configured (`npm test` is a no-op) |

## Commands

```bash
# Development
quasar dev          # Dev server at http://localhost:8180

# Production build (PWA)
quasar build        # Output: dist/spa/

# Lint
npm run lint        # ESLint

# Firebase Cloud Functions (run inside functions/)
cd functions && npm install
firebase deploy --only functions

# Hosting deploy
firebase deploy --only hosting
```

There is **no test suite**. `npm test` exits successfully without running anything.

## Repository layout

```text
accounting-pwa/
├── src/
│   ├── boot/
│   │   ├── firebase.js
│   │   ├── axios.js
│   │   └── darkMode.js
│   ├── pages/
│   │   ├── LogIn.vue
│   │   ├── IndexPage.vue
│   │   ├── ExpenseRecords.vue
│   │   ├── ExpenseAnalysis.vue
│   │   ├── SpendingResults.vue
│   │   ├── GroupMembers.vue
│   │   ├── GroupSetting.vue
│   │   └── ErrorNotFound.vue
│   ├── layouts/
│   │   └── MainLayout.vue
│   ├── components/
│   │   ├── AlertDialog.vue
│   │   └── EssentialLink.vue
│   ├── router/
│   │   ├── index.js
│   │   └── routes.js
│   ├── stores/
│   ├── utils/
│   │   └── generateDate.js
│   ├── css/
│   │   ├── app.scss
│   │   ├── tailwind.css
│   │   └── quasar.variables.scss
│   ├── assets/
│   ├── api/
│   └── App.vue
├── src-pwa/
├── functions/
│   ├── index.js
│   └── package.json
├── public/
├── quasar.config.js
├── tailwind.config.js
├── postcss.config.cjs
├── firebase.json
├── .firebaserc
├── .env
├── README.md
├── AGENTS.md
└── CLAUDE.md
```

## Routing

`src/router/routes.js` defines a single layout (`MainLayout.vue`) with auth-protected children. All non-login routes carry `meta.requiresAuth: true`; the guard in `src/router/index.js` redirects unauthenticated visitors to `/login` via `onAuthStateChanged`.

| Path | Name | Component | Purpose |
|------|------|-----------|---------|
| `/` | `home` | `IndexPage.vue` | Pick or create a group |
| `/group/:groupName/records` | `records` | `ExpenseRecords.vue` | Per-month expense list, add/edit/delete |
| `/group/:groupName/analysis` | `analysis` | `ExpenseAnalysis.vue` | Category breakdown and date-range analytics |
| `/group/:groupName/settlement` | `settlement` | `SpendingResults.vue` | Debt-settlement calculator + currency conversion |
| `/group/:groupName/members` | `members` | `GroupMembers.vue` | Manage members and virtual members |
| `/group/:groupName/setting` | `setting` | `GroupSetting.vue` | Fixed expenses + custom categories |
| `/login` | `login` | `LogIn.vue` | Google OAuth entry point |
| `/:catchAll(.*)*` | — | `ErrorNotFound.vue` | 404 |

`groupName` is passed as a prop to each page route.

## Data flow

- There is **no domain Pinia store**. Each page imports helpers directly from `src/boot/firebase.js` and manages its own `onValue` listeners.
- `src/boot/firebase.js` is the single Firebase entrypoint. It exports:
  - `auth`, `db`, `provider`, `signInWithPopup`
  - `ref`, `set`, `get`, `update`, `onValue`, `child`, `remove`, `push`
- `src/boot/axios.js` exists but is currently unused for core app data.
- Firebase credentials come from Vite env vars with the `VITE_` prefix.

### Realtime Database shape

```text
/groups/
  <groupName>/
    members/
      <memberId>: { id, name, email?, photoURL?, isVirtual? }
    expenses/
      <YYYY-MM>/
        <expenseId>: {
          id, description, amount,
          date,
          payer: { label, value },
          members: [{ label, value }],
          type: { label, value, icon },
          splitMethod?: 'equal' | 'shares' | 'exact' | 'percentage',
          splitDetails?: { <memberId>: number }
        }
    groupSettings/
      fixedExpenses/
        <expenseId>: {
          name, amount,
          date: { label, value },
          payerId: { label, value },
          installments: boolean,
          paymentTerms?: number
        }
      customCategories/
        <categoryId>: { label, value, icon }
```

This shape is a working convention, not a strict contract. When changing behavior, inspect `src/pages/*.vue` for authoritative reads and writes.

## Pages

### `LogIn.vue`

Google OAuth via `signInWithPopup(auth, provider)`. On first login, creates a user record under `/users/<uid>` if missing.

### `IndexPage.vue`

Lists groups the current user belongs to. Supports creating a group or joining an existing one by name, then routes to `/group/<name>/records`.

### `ExpenseRecords.vue`

Per-month expense list with add/edit/delete dialog.

Important details:
- Uses `generateMonths()` for the month picker.
- Supports four split methods: `equal`, `shares`, `exact`, `percentage`.
- Validates non-equal split modes before save.
- Saves records directly to `/groups/<groupName>/expenses/<YYYY-MM>/<recordId>`.
- Current implementation is a single route component using `<script setup>`, with dialog state and save logic kept locally.

### `ExpenseAnalysis.vue`

Reads expenses for a chosen month or custom date range and renders pie chart, bar chart, and category totals table via ECharts.

### `SpendingResults.vue`

Computes net settlement based on each expense and split method, then optionally applies one currency conversion to final settlement output.

### `GroupMembers.vue`

Manages group members, including virtual members. Removal of real members is intentionally limited to preserve historical consistency.

### `GroupSetting.vue`

Manages fixed expenses and custom categories.

## Key concepts

- **Virtual members**: members without Firebase accounts; they still participate in expense splits and settlement.
- **Fixed expenses**: configured in `GroupSetting.vue` and auto-inserted by a scheduled Cloud Function.
- **Custom categories**: user-defined categories merged with built-in categories at display time.
- **Currency conversion**: applied only in settlement, not at record entry time.

## Cloud Function

`functions/index.js` exports `autoAddFixedExpenses`, scheduled for `every day 10:30` in `Asia/Taipei`.

Current behavior:
1. Read `/groups`.
2. Find fixed expenses whose configured day matches today.
3. Insert synthesized expense records into the current month bucket.
4. Decrement installment counters and remove completed entries when needed.

## Boot files

`quasar.config.js` loads these boot files:

- `firebase.js`: Firebase initialization and exported helpers
- `axios.js`: shared Axios instance
- `darkMode.js`: dark-mode persistence and synchronization between Quasar and Tailwind

## Styling conventions

- Tailwind utilities are prefixed with `tw-`.
- Dark mode is class-based via `html.dark`, coordinated with Quasar's dark mode.
- Quasar classes and Tailwind utilities are mixed freely in templates.
- When editing UI, verify dark-mode contrast because the app has had readability regressions before.

## Environment variables

Create a root `.env` file with:

```bash
VITE_API_KEY=
VITE_AUTH_DOMAIN=
VITE_PROJECT_ID=
VITE_STORAGE_BUCKET=
VITE_MESSAGING_SENDER_ID=
VITE_APP_ID=
VITE_MEASUREMENT_ID=
VITE_DATABASE_URL=
```

`.env` is gitignored. Cloud Functions use deployed service account credentials.

## Planned feature: receipt scan for expense entry

The next planned feature is a **receipt scanning flow** for expense creation.

### Product scope for V1

- Entry point lives in the expense creation flow on `ExpenseRecords.vue`
- User uploads or takes **one receipt image**
- AI parses and suggests:
  - `description`
  - `amount`
  - `date`
  - `type`
- User must review and confirm before saving
- Do **not** auto-write parsed results directly into the database
- Do **not** infer payer, participants, or split method
- Do **not** support per-expense currency in V1
- Do **not** support multi-image batch scanning in V1

### Implementation order

1. Refactor `src/pages/ExpenseRecords.vue` so the page remains the data container and orchestration layer only.
2. Extract the add/edit expense dialog into `src/components/expense/ExpenseFormDialog.vue`.
3. Add `src/components/expense/ReceiptScanPanel.vue` for image upload, preview, loading state, parse error state, and scan-result application.
4. Wire a mock scan response first so the UI and form-prefill workflow can be validated before any backend AI integration.
5. Add `src/api/receiptScan.js` as the single frontend integration point for receipt parsing.
6. Add a Firebase Cloud Function named `scanExpenseReceipt` in `functions/index.js`.
7. The function should only authenticate, parse the uploaded receipt image, normalize output, and return structured JSON.
8. Keep actual expense persistence in the existing front-end save flow; parsed data only pre-fills the form.
9. After end-to-end parsing works, add loading, validation, and error handling polish.

### Output contract for receipt parsing

The parser should return structured JSON with these fields:

```json
{
  "description": "string",
  "amount": 123,
  "date": "YYYY-MM-DD",
  "suggestedType": "food",
  "merchantName": "string",
  "confidence": {
    "amount": 0.95,
    "date": 0.90,
    "description": 0.78,
    "type": 0.65
  },
  "rawTextSnippet": "string"
}
```

### Category constraints

`suggestedType` must map to one of the existing values only:

- `transportation`
- `food`
- `entertainment`
- `pets`
- `housing`
- `supplies`
- `investment`
- `shopping`
- `other`

### UX fallback rules

- If `amount` is missing, do not auto-apply it.
- If `date` is missing, keep the form default date and ask the user to confirm.
- If `suggestedType` cannot be mapped, fall back to `other`.
- Manual expense entry must remain fully usable even if scanning fails.
