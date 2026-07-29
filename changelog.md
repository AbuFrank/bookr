# Changelog

## July 29, 2026

- Split `context/authContext.tsx` into `context/sessionContext.tsx` (`SessionProvider`, read via `hooks/useAuth.ts` — Firebase `user`/`isAuthenticated`/`loading`/`loginWithGoogle`/`logout` only) and `context/dataContext.tsx` (`DataProvider`, read via new `hooks/useData.ts` — the four Firestore reducers plus `hasUnsavedReportChanges`). `DataProvider` now reads `user` from `SessionContext` and reloads/resets Firestore data off an effect keyed on it, instead of doing the load inline in the Firebase auth listener — as a side effect, data now resets on *any* sign-out (not just the explicit logout button, which was the only path that reset reducers before). Renamed the data-fetch loading flag to `dataLoading` to stop it colliding with `SessionContext.loading` (auth resolving) now that a few components (`Header`, `ReportTrigger`, `PageBooks`, `PageTransactions`) need both hooks at once.
- Remove ~100 scratch `console.log` calls across `src/` and `server/` (kept genuinely useful ones: server startup, service-account init, sync start/success bookends); upgraded the documented out-of-range-account skip in `updateSpreadsheet` from `console.log` to `console.warn` to match what the docs already said it did. Fixed two real bugs the cleanup surfaced: `generateFirestoreId` (`lib/firestore.ts`) was logging one generated Firestore doc ID while returning a different one from a second `doc(collectionRef)` call; and removing a log line in `updateSpreadsheet` (`server/google-auth.js`) that happened to end with a semicolon exposed a pre-existing ASI hazard — the following `})` had none, so `['D', 'ND'].forEach(...)` on the next line was parsed as a computed-member access off the previous statement's return value, throwing `Cannot read properties of undefined (reading 'ND')` on every sync. Caught by the test suite, not shipped.

- Shift the Expense/Non-Deductible-Expense accountNumber ranges: Deductible Expenses 1-49 → 1-50, Non-Deductible Expenses 50-56 → 51-57 (`E_ACCOUNT_NUMBER_RANGE`/`NE_ACCOUNT_NUMBER_RANGE`, `helpers/ledger.ts`; `MaxE`/`cellLocations.NE.accountNumberStart`, `server/google-auth.js`). The out-of-range skip and $0-blanking logic in `updateSpreadsheet` already derives from these constants, so no separate change was needed there.
- Editing a fiscal year's starting balance now triggers the same "unsaved changes" state as editing a transaction (disables until "Update Report" syncs, warns on tab close, confirms on sign-out) — previously it saved to Firestore without marking the Google Sheet report stale, even though it feeds the first ledger's running total (`updateFolder`, `authContext.tsx`)
- Fix the Create Account form's subtype toggle label always reading "Non-Income"/"Non-Deductible" regardless of whether the switch was actually on — it now reads "Income"/"Deductible" when off and "Non-Income"/"Non-Deductible" when on, based on both the switch state and the selected account type (`FormTransaction.tsx`)
- Widen the deposit accountNumber ranges: business deposit accounts 101-116 → 101-150, non-income deposit accounts 151-157 → 151-200 (`D_ACCOUNT_NUMBER_RANGE`/`ND_ACCOUNT_NUMBER_RANGE`, `helpers/ledger.ts`). Unlike the Expense/Non-Deductible-Expense ranges, these were never tied to a physical sheet row budget — deposits are always written chronologically by transaction, not grouped by account row — so they were free to expand for more numbering headroom.
- Fix a deleted transaction's account not disappearing from the Account Summary sheet on the next "Update Report" sync: `updateSpreadsheet` (`server/google-auth.js`) now blanks an Expense/Non-Deductible-Expense account's row once its combined total (this ledger's value plus everything carried forward) drops to $0, instead of leaving the stale account name next to $0 values. Deposits/Non-Income Deposits rows now always rewrite their whole row budget (`MaxD`/`MaxND`) each sync instead of only as many rows as there are current transactions, so a deleted deposit's row is blanked rather than left showing stale data (deposits list chronologically with no fixed per-account row, so there's no other way to detect "this row used to have something"). Forward propagation to later ledgers in the same fiscal year already worked via the existing running-totals walk in `calculateAccountTotals` and needed no change.
- Fix the above account-clearing not actually firing for an account whose *only* transaction in the entire fiscal year was the one deleted: `calculateAccountTotals` (`helpers/ledger.ts`) only ever tracked an account once it found a transaction for it in some ledger, so with zero transactions left anywhere it never appeared in any ledger's payload at all - now every Expense/Non-Deductible-Expense account is seeded into the running-totals tracker up front (at $0), so it always produces an entry for `updateSpreadsheet` to blank.
- Extend the same "always rewrite the full row budget" fix to the Ledger sheet's transaction register (`updateSpreadsheet`, rows 5-50/`MaxLedgerRows`=46): previously it only wrote as many rows as there were current transactions, so deleting a transaction left its old row's data on the sheet with nothing overwriting it. It now writes all 46 rows every sync, blanking any row past the current transaction count.
- Restyle the Create Account form's Type field from a `select` dropdown to two pressed/depressed toggle buttons (Deposit/Expense), and its Non-Deductible/Non-Income field from a checkbox to a sliding switch (gray-left when off, blue-right when on); same underlying `handleAccountFormChange`/validation logic, UI only
- Add inline transaction editing: an Edit button on each `TransactionList` row swaps its check number, date, payee, memo, and amount cells for inputs (account stays read-only), Save calls the existing `updateTransaction`. Added `fromUTCDateOnly` (`helpers/date.ts`) as the inverse of `toUTCDateOnly` so the date picker shows the transaction's stored UTC day as the correct local calendar day when editing, instead of shifting a day in timezones behind UTC.
- Write each transaction's memo to the Ledger sheet: the template's per-row merge was split into columns C-E ("Payment to/deposit from") and F-I ("Memo"), so `updateSpreadsheet` (`server/google-auth.js`) now writes `transaction.memo` into the new merge instead of leaving it blank
- Combine "Payment to/deposit from" and memo into one `"paidTo - memo"` string (falling back to just `paidTo` when there's no memo) for the Account Summary sheet's Deposits/Non-Income Deposits rows, via the new `getDepositDescription` (`helpers/ledger.ts`)
- Fix transaction dates showing as `NaN/NaN` or shifted a day off in the spreadsheet: `convertFirestoreTimestamp` (`server/google-auth.js`) only handled Firestore `Timestamp`-shaped values (`{seconds}`), so a transaction added earlier in the same session — still holding a raw JS `Date` in client state rather than a reloaded Firestore `Timestamp` — serialized to a plain ISO string over `/update-sheets` and produced an Invalid Date. Separately, `formatDate` read the day via local `getMonth()`/`getDate()`, which depends on whatever timezone the server process happens to run in rather than the timezone the date was picked in. Fixed by anchoring picked dates to UTC midnight on write (`toUTCDateOnly`, `src/helpers/date.ts`, used in `PageTransactions.tsx`) and reading dates back with UTC getters everywhere (server `formatDate`, and the app's own `formatFirestoreDate` display) instead of local ones
- Re-range the Account Summary sheet's Expense/Non-Deductible-Expense accountNumber allotments to match the reworked template layout: Deductible Expenses now 1-49 (was 1-51), Non-Deductible Expenses now 50-56 (was 75-81, same physical rows)
- Track unsaved report changes: adding, editing, or deleting a transaction now flags the report as out of sync (`hasUnsavedReportChanges` in `authContext.tsx`), cleared only once `/update-sheets` reports every ledger write succeeded. While there are unsaved changes, closing/refreshing the tab prompts a browser confirmation and signing out asks for confirmation; the "Update Report" button is disabled/grayed out except when there's actually something to sync, and shows an "Updating..." state while the request is in flight (previously `isProcessing` was set but never actually flipped to `true`, so that state never fired)
- Fix `googleDriveAPI.updateSheetCells` discarding the `/update-sheets` response body entirely instead of parsing it — callers had no way to check per-ledger `success` at all
- Move the "Update Report" button to the top-right of the Ledger/transactions table section (was floating at the bottom of the page), and restyle "Add Transaction"/"Close Form" to the same solid blue button used elsewhere instead of the old `bg-primary`/`bg-secondary` classes
- Remove the raw JSON dump of the calculated update payload that `ReportTrigger` printed to the page on every sync

## July 28, 2026

- Fix the fiscal year's starting balance never reaching `currentFiscalYear` in app state or the Firestore folder doc — `googleDriveAPI.createFolder` persisted the new fiscal-year folder to Firestore before `startingBalance` was merged in, and `PageBooks.tsx` then called `setCurrentFiscalYear` with that unmerged copy instead of the one patched with the balance. `createFolder` now accepts an optional `startingBalance` and writes it at creation time, so the value is correct in-session and survives a reload.
- Fix `updateFolder` (`authContext.tsx`) only updating in-memory folder state and never writing to Firestore, so any folder edit was silently lost on reload
- Add an editable starting balance to the chronologically-first ledger's card (transactions page): shows `Starting balance: $X` with a pill-style Edit button that swaps in an inline input, so the fiscal year's starting balance can be corrected later without going into the Firestore console
- Add an `Acct #` column (center-aligned) to the transactions table, showing each transaction's account number
- Sort the transactions table and the Ledger sheet's register rows by transaction creation time ascending (oldest first) instead of whatever order Firestore happened to return

## July 25, 2026

- Fix the Account Summary sheet silently skipping every Expense/Non-Deductible-Expense account whose `accountNumber` was stored as a string in Firestore (accounts created before the July 21 account-number fix)
- Fix the Ledger sheet's check-number column (B) always writing blank — it read a `checkNo` field that never existed on `FirestoreTransaction` (`checkNumber` is the real field)
- Populate the Ledger sheet's account-number column (J) with each transaction's actual account number, resolved via the account instead of a nonexistent field on the transaction
- Write the Ledger sheet's account-number column as a real number instead of text, fixing spreadsheet formulas (e.g. the running balance `IFS`) that branch on it numerically — Sheets treats numeric-looking text as always greater than any number in comparisons
- Shorten Ledger/Account Summary date cells from `mm/dd/yy` to `mm/dd`
- Fix newly created/edited/deleted accounts not appearing in the account dropdown until switching books or reloading — `currentAccounts` wasn't being kept in sync with `accounts` on account CRUD (the same fix already existed for ledgers)

## July 21, 2026

- Add `firestore.rules` (userId-scoped read/write/create/update per collection, ownership can't be reassigned on update) — the previous rules allowed anyone with the project ref to read/write and were set to expire 2026-08-01; needs to be pasted into the Firebase console manually
- Rewrite the Account Summary sheet's Deposits/Non-Income Deposits sections to list transactions chronologically (date, payee, amount) instead of grouping by account, matching the physical template
- Place each Expense/Non-Deductible Expense account on a fixed sheet row determined by its own `accountNumber` (Deductible: 1-51, Non-Deductible: 75-81) instead of write order, so accounts don't shift rows between syncs; add range validation on account creation
- Fix a bug where the "Create New Account" Type dropdown and Non-Deductible/Non-Income checkbox were wired to the transaction form's state instead of the new-account state, which silently blocked account creation from working at all
- Add a memo field to transactions, shown below the payee on the ledger table
- Add payee autocomplete (history of past "Payment To / Deposit From" values) on the transaction form
- Make ledger name/description editable after creation
- Show combined "Expense | Non-Ded" / "Deposit | Non-Inc" labels on the transaction list when an account has a subType, and fix a stale "To Whom Paid" table header

## July 12, 2026

- Move `type`/`subType` off the transaction record and onto the account ("Phase 2" data model change) — transactions now resolve their type by looking up the account instead of storing it redundantly, fixing a bug where stale/absent per-transaction type data was trusted over the account's
- Add `accountNumber` to accounts: shown in the account dropdown (e.g. `"3 - Groceries"`) and used to prevent duplicate account numbers within a book
- Add a Vitest suite (85 tests): reducers, `helpers/ledger`, `helpers/folders`, `helpers/date`, `lib/firestore`, `types/spreadsheetTypes`, `server/google-auth`, and `api/routeParity.test.js`, which asserts the Express routes (`server/googleDriveRoutes.js`) and the Vercel `api/*.js` handlers behave identically
- Return a consistent 401 `Invalid Token` from `/folder`, `/copy-template`, and `/update-sheets` (both Express and Vercel entry points) when Google reports invalid credentials
- Start tracking `notes.txt` in git

## May 18, 2026

- Add starting balance to the fiscal year folder and propagate a running `lastTotal` through each ledger's spreadsheet update

## May 15, 2026

- Add a starting balance field when creating a fiscal year's first ledger, propagated as the running total through all subsequent ledgers in that year

## May 14, 2026

- Extract `FormBook` into its own component
- Fix a bug when switching to a fiscal year that has no ledgers yet
- Remove unused `useEffect`s from `authContext`

## May 13, 2026

- Include transactions in the update payload sent when a new ledger sheet is created

## May 7, 2026

- Add a dedicated summary sheet/tab to the ledger template

## April 24, 2026

- Prevent creating duplicate fiscal years within a group
- Automatically navigate to `/transations` after creating new fiscal year
- Add mobile UI/UX fixes to transactions page
- Fix vercel deployment 404 on protected routes by telling vercel how to handle the SPA (verel.json)