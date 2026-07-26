# Changelog

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