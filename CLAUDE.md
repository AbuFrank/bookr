# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bookr: a personal finance tracker. React/TypeScript/Vite frontend, Firebase (Auth + Firestore) for app data, and an Express server that acts as a service-account proxy to the Google Drive/Sheets APIs (each fiscal year's ledger is a copied Google Sheet template that gets kept in sync with Firestore transaction data).

## Commands

```bash
npm run dev          # runs client (vite, port 3000) and server (nodemon) concurrently
npm run dev:client    # vite only
npm run dev:server    # nodemon server/index.js only, proxies /api -> localhost:3001
npm run build         # tsc -b && vite build
npm run lint          # eslint .
npm run preview       # preview production build
npm start             # node server/index.js (production, serves dist/ + /api)
npm test              # vitest run (all suites, node environment)
npm run test:watch    # vitest watch mode
```

### Tests

Vitest, configured in `vite.config.ts` (`test.include`: `src/**/*.test.{ts,tsx}`, `server/**/*.test.js`, `api/**/*.test.js`). 108 tests across 12 files as of this writing — reducers, `helpers/{ledger,folders,date,transactions}`, `lib/firestore`, `types/spreadsheetTypes`, `server/google-auth`, and `api/routeParity.test.js`. That last one drives both `server/googleDriveRoutes.js` and the matching `api/*.js` handler with the same mocked `server/google-auth.js` and asserts identical status codes/bodies — it's the guardrail for the "keep both call sites in sync" rule below, so a signature or error-handling change to one side that isn't mirrored on the other will fail it.

### Local server setup

The Express server needs `server/.env.local` (`GOOGLE_TEMPLATE_ID`, `GOOGLE_SOURCE_ID`, `GOOGLE_PARENT_FOLDER_ID`) and a `server/cfcc-service-account-key.json` Google service-account key. In production (Vercel), the key comes from `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` instead (base64-encoded JSON) — see `getServiceAccountDrive()` in `server/google-auth.js`.

## Architecture

### Data model / folder hierarchy

Firestore-backed entities, all scoped by `userId`:

- **Folder** (`types/folderTypes.ts`) — mirrors a Google Drive folder tree: `Bookr App` (root, auto-created on first login) → **book** (a named group, e.g. a business or household) → **fiscal year** (named by year, holds `startingBalance`) → ledgers live inside a fiscal year folder. `helpers/folders.ts#sortFoldersIntoTree` rebuilds this tree from the flat Firestore list for `FolderTree`/`PageBooks`.
- **Ledger** (`types/ledgerTypes.ts`) — one per Google Sheet, created by copying a template file (`googleDriveAPI.copyReportTemplate` → `POST /api/copy-template` → `copyTemplateFile` in `server/google-auth.js`). Holds `fileId` (the Sheet's Drive file id) and `parentFolderId` (the fiscal year folder).
- **Account** (`types/accountTypes.ts`) — a bank account/category scoped to a book (`bookId`), with an `accountNumber` (used for dedup and display, e.g. `"3 - Groceries"` in `FormTransaction`) and typed as `deposit`/`expense` with an optional `subType` of `non-deductible` (expense) or `non-income` (deposit). These four combinations map to the sheet's column groups: `E` (expense), `NE` (non-deductible expense), `D` (deposit/receipt), `ND` (non-income deposit) — see `cellLocations` in `server/google-auth.js`. **Deductible expense accounts must be numbered 1-49, non-deductible expense accounts 50-56, business deposit accounts 101-150, and non-income deposit accounts 151-200** (`helpers/ledger.ts#getAccountNumberRange`/`isAccountNumberInRange`, enforced on creation in `PageTransactions.tsx`) — the expense ranges are a fixed property of the physical Google Sheet template (each number maps directly to a row) and must stay in sync with `MaxE`/`MaxNE`/`accountNumberStart` in `server/google-auth.js#cellLocations`. The deposit ranges are *not* tied to any row budget — deposits are always written chronologically by transaction rather than grouped by account row (see below), so an account's number never determines its row — they're just a wide numbering space (50 slots each) for bookkeeping/dedup purposes.
- **Transaction** (`types/transactionTypes.ts`) — belongs to an account and a ledger (`ledgerId`), and holds only `accountId`/`value`/date/etc. **It does not carry its own `type`/`subType`** — those live solely on the `Account`. Always resolve a transaction's type via `getAccountTypeCode`/`findAccountById` in `helpers/ledger.ts` (looking it up by `accountId`), never read `transaction.type` — that field was removed from `FirestoreTransaction` in the "Phase 2" pass (see `changelog.md`) after it caused a bug where stale/absent per-transaction type data was trusted instead of the account's.

### Frontend state

All app state lives in `context/authContext.tsx` (`AuthProvider`), composed from four `useReducer` stores (`reducer/{transaction,account,ledger,folder}Reducer.tsx`), each with its own Action-type enum in the matching `types/*.ts` file. On Firebase auth state change, transactions/accounts/ledgers/folders are all loaded in parallel and dispatched into their reducers. There is no other global state — components read everything through `hooks/useAuth.ts`.

`updateBooks(groupFolder, yearFolder)` is the pivot when switching book/fiscal year: it filters accounts by `bookId` and ledgers by `parentFolderId`, then sets the most-recently-created ledger in that year as `currentLedger`.

The account and ledger reducers each keep a full list (`accounts`/`ledgers`) plus a book/year-scoped "current" list (`currentAccounts`/`currentLedgers`) that `updateBooks` derives from the full list — but the reducers themselves only ever touch the full list on add/update/delete, so every mutating action in `authContext.tsx` (`addAccount`/`updateAccount`/`deleteAccount`, `addLedger`/`updateLedger`) has to separately dispatch a `SET_CURRENT_*` update, or the change won't show up anywhere in the UI until the next book/year switch. Folders are the exception — `folderReducer.tsx` updates `currentChildren` inside the reducer itself. Transactions don't need this at all: `currentTransactions` is derived by a `useEffect` keyed off `ledgerState.currentLedger`, so it re-syncs automatically.

Pages: `PageBooks.tsx` (create/select book + fiscal year, creates the Drive folder chain) and `PageTransactions.tsx` (ledger + transaction CRUD, gated by `ProtectedRoute` requiring a `currentFiscalYear`/`currentBook`).

`hasUnsavedReportChanges` (also in `authContext.tsx`) tracks whether the Google Sheet report is stale relative to Firestore: `addTransaction`/`updateTransaction`/`deleteTransaction` set it `true`, and so does `updateFolder` (a fiscal year's `startingBalance` seeds its chronologically-first ledger's running total, same as a transaction edit — see `calculateAccountTotals`). It's only cleared by `markReportSaved()`, which `ReportTrigger` calls after `/update-sheets` reports every ledger write succeeded (a partial failure leaves it `true`). It gates the "Update Report" button's disabled state, drives a `beforeunload` browser warning, and guards the Header's sign-out action with a confirm — so it has to actually reach `false` on a real successful sync, not just after the request completes.

### Google Sheets sync

Firestore is the source of truth; the Sheet is a generated report kept in sync manually. `ReportTrigger` calls `helpers/ledger.ts#calculateAccountTotals`, which walks *all* ledgers in the current fiscal year in chronological order and returns per-ledger `Update` payloads from the *current* ledger forward, sent as one batch to `PUT /api/update-sheets` → `updateSpreadsheet` in `server/google-auth.js`, which writes fixed cell ranges (`cellLocations`) via `sheets.spreadsheets.batchUpdate`. The Account Summary sheet has two different write strategies depending on section, matching the physical template:

- **Deposits (`D`) / Non-Income Deposits (`ND`)** — one row per **transaction**, listed chronologically (date/payee/amount), not grouped by account. Built fresh per-ledger in `calculateAccountTotals` (not carried forward — a ledger with no deposit activity produces an empty array).  `updateSpreadsheet` always rewrites the section's full row budget (`MaxD`/`MaxND`) on every sync, blanking any row past the current transaction count — otherwise a deleted deposit would leave its old row's data on the sheet, since there's no per-account row to know it needs clearing. `lastDTotal`/`lastNDTotal` (cumulative totals seeded from the fiscal year's `startingBalance`) are still tracked and written to their own footer cells.
- **Expenses (`E`) / Non-Deductible Expenses (`NE`)** — one row per **account**, with the row determined by the account's own `accountNumber` (`cellLocations[type].row + (accountNumber - accountNumberStart)`), not by write order. `calculateAccountTotals` seeds every `E`/`NE` account into its running-totals tracker up front (at $0), so every account produces a write request on every ledger regardless of activity — without this, an account whose only transaction ever gets deleted would simply vanish from the payload with nothing left to clear its stale row. `previousTotal` carries forward across ledgers via that same tracker. In `updateSpreadsheet`, an account whose combined total (this ledger's `value` + carried-forward `previousTotal`) is exactly `0` has its name blanked instead of writing 0 next to a stale name — this is what actually "deletes" a line when an account's activity nets to zero. `updateSpreadsheet` also skips (with a console warning) any account whose number falls outside its section's valid range instead of computing a bogus row index.

Each Account Summary section has a fixed row budget (`MaxE`/`MaxNE`/`MaxD`/`MaxND`) — for `D`/`ND` this caps the transaction list at that many rows per ledger; for `E`/`NE` it's implied by the accountNumber range itself. Writes beyond budget are silently dropped for `D`/`ND` (see TODOs in `notes.txt`/`changelog.md`). The Ledger sheet (register of individual transactions, rows 5-50/`MaxLedgerRows`=46) follows the same always-rewrite-the-full-budget pattern as `D`/`ND` for the same reason — a deleted transaction otherwise leaves its old row's data unmodified.

### Server vs. `api/`

Google API logic (`copyTemplateFile`, `createFolder`, `updateSpreadsheet`, `getServiceAccountDrive`) lives once in `server/google-auth.js` and is used two ways:
- `server/googleDriveRoutes.js` — Express routes mounted under `/api` for local dev (`npm run dev:server` / `npm start`).
- `api/*.js` — standalone Vercel serverless functions that import from `../server/google-auth.js` directly, used in the Vercel deployment instead of the long-running Express server.

Keep both call sites in sync when changing the shared `server/google-auth.js` functions' signatures — `api/routeParity.test.js` (see Tests above) fails if the two diverge in status codes or response bodies.

### Auth

Firebase Google Sign-In (`firebase/authService.ts`, `firebase/firebase.ts`). The Drive/Sheets calls are *not* authenticated as the end user — a single service account (shared via `GOOGLE_PARENT_FOLDER_ID`) owns all files and grants the user's email `reader` access after creating/copying each file. `googleDriveAPI` (`lib/googleDriveClient.ts`) tracks the current Firebase user only to attach their email to API calls, not for token auth.

### Firestore security rules

`firestore.rules` at the repo root is a **reference file only** — there's no `firebase.json`/CLI deploy config, so changes to it must be pasted into the Firebase console by hand. It scopes read/create/update/delete on `folders`/`ledgers`/`accounts`/`transactions` to `request.auth.uid == userId` (doc IDs are client-generated via `generateFirestoreId` in `lib/firestore.ts`, so there's no `docId == uid` shortcut) and blocks reassigning a doc's `userId` on update.

## Known rough edges (see `notes.txt`, `changelog.md`)

- `/auth/google` OAuth route in `googleDriveRoutes.js` is dead code left over from a prior per-user-token auth flow (references an undefined `oauth2Client`); the app now uses the shared service account instead.
- Ledger/ledger-total recalculation re-walks every ledger in a fiscal year on every sync; there's no persisted running total on the ledger doc yet (see the `TODO`s in `calculateAccountTotals`, `helpers/ledger.ts`).
- `updateSpreadsheet` (`server/google-auth.js`) swallows its own errors (`catch` logs and returns `undefined` instead of rethrowing), so a failed sheet write shows up as `{ success: false, data: undefined }` in the `/update-sheets` response rather than an HTTP error — callers must check `success` per-index, not just the overall request status.
- `notes.txt` is the running scratch todo list (`+` = done, `-` = open) plus open questions from the user about spreadsheet layout; check it before starting new ledger/UI work, and update it (don't just leave stale `-` items) as todos are completed.
- When writing a cell that a sheet formula compares numerically (e.g. an `IFS` branching on `<`/`>`), write `numberValue`, not `stringValue` — Google Sheets treats text as always greater than any number in comparisons, so a numeric-looking string (like an account number) can silently break formulas that expect to branch on its numeric range.
- A transaction's `date` (the calendar day picked in `MyDatePicker`, distinct from `dateCreated`) is anchored to UTC midnight before it's stored (`toUTCDateOnly` in `helpers/date.ts`, applied in `PageTransactions.tsx`), and always read back with UTC getters — `formatFirestoreDate` (client) and `formatDate` (`server/google-auth.js`) both use `getUTC*`, never local `getMonth()`/`getDate()`. Reading with local getters lets the day shift depending on whatever timezone the reading process (browser or server) happens to be in, independent of where the date was picked — that's what caused dates to display a day off (or `NaN`, when a transaction added earlier in the same client session hadn't round-tripped through Firestore yet and was still a raw JS `Date` rather than a `Timestamp`) when synced from a different timezone than the picker's. When feeding a stored date back into `MyDatePicker` (e.g. editing a transaction), use `fromUTCDateOnly` — the inverse of `toUTCDateOnly` — rather than passing the raw stored value; it builds a local `Date` from the stored value's UTC Y/M/D so the picker shows the right calendar day and, if resubmitted unchanged, round-trips back through `toUTCDateOnly` to the same value.

## History

`changelog.md` has dated entries summarizing shipped changes; check it for what happened recently before assuming this doc is fully current, and add an entry there (not here) when finishing a batch of work.
