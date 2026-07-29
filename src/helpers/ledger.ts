// import { findAccountById } from "../lib/firestore";
import type { FirestoreAccount } from "../types/accountTypes";
import type { Folder } from "../types/folderTypes";
import type { Ledger } from "../types/ledgerTypes";
import { isValidKey, type DepositUpdateItem, type Update } from "../types/spreadsheetTypes";
import type { FirestoreTransaction } from "../types/transactionTypes";
import { toComparableTime } from "./date";

/**
 * Combines a deposit transaction's "paid to/deposit from" and memo into the
 * single description string written to the Deposits/Non-Income Deposits rows
 * on the Account Summary sheet, e.g. "Paycheck - March bonus". Omits the
 * " - " separator when there's no memo.
 */
export const getDepositDescription = (paidTo: string, memo?: string): string =>
  memo ? `${paidTo} - ${memo}` : paidTo

/**
 * Maps an account's type/subType (e.g. type: 'expense', subType: 'non-deductible')
 * to its spreadsheet column group code.
 */
export const getAccountTypeCode = (account: FirestoreAccount): 'E' | 'NE' | 'D' | 'ND' => {
  if (account.type === 'expense') {
    return account.subType === 'non-deductible' ? 'NE' : 'E'
  }
  return account.subType === 'non-income' ? 'ND' : 'D'
}

/**
 * Valid accountNumber ranges, matching the fixed row allotments on the
 * Account Summary sheet template (Deductible Expenses: rows for 1-49,
 * Non-Deductible Expenses: rows for 50-56, Business Deposits: rows 6-21,
 * Non-Income Deposits: rows 30-36). Deposits are still listed chronologically
 * by transaction rather than grouped by account row (see calculateAccountTotals),
 * so these ranges are enforced for bookkeeping consistency only.
 */
export const E_ACCOUNT_NUMBER_RANGE: [number, number] = [1, 49];
export const NE_ACCOUNT_NUMBER_RANGE: [number, number] = [50, 56];
export const D_ACCOUNT_NUMBER_RANGE: [number, number] = [101, 116];
export const ND_ACCOUNT_NUMBER_RANGE: [number, number] = [151, 157];

export const getAccountNumberRange = (
  type: 'deposit' | 'expense' | null,
  subType: 'non-deductible' | 'non-income' | null
): [number, number] | null => {
  if (type === 'expense') {
    return subType === 'non-deductible' ? NE_ACCOUNT_NUMBER_RANGE : E_ACCOUNT_NUMBER_RANGE;
  }
  if (type === 'deposit') {
    return subType === 'non-income' ? ND_ACCOUNT_NUMBER_RANGE : D_ACCOUNT_NUMBER_RANGE;
  }
  return null;
};

export const isAccountNumberInRange = (
  type: 'deposit' | 'expense' | null,
  subType: 'non-deductible' | 'non-income' | null,
  accountNumber: number | string | null
): boolean => {
  const range = getAccountNumberRange(type, subType);
  if (!range) return true;
  const num = Number(accountNumber);
  if (Number.isNaN(num)) return false;
  const [min, max] = range;
  return num >= min && num <= max;
};

/**
 * Finds an account by its unique account ID.
 *
 * @param accounts - The array of accounts to search.
 * @param accountId - The unique ID of the account to find.
 * @returns The matching account, or `undefined` if no account is found.
 */
export const findAccountById = (
  accounts: FirestoreAccount[],
  accountId: string
): FirestoreAccount | undefined => {
  return accounts.find((account) => account.id === accountId);
};

// totals each account within each ledger; accumulating for each consecutive ledger.
export const calculateAccountTotals = (transactions: FirestoreTransaction[], currentLedger: Ledger, currentLedgers: Ledger[], accounts: FirestoreAccount[], currentFiscalYear: Folder) => {
  // Track updated ledgers so that we can replace 
  // Track running balance in case we're updating an old ledger
  let lastTotal = currentFiscalYear.startingBalance || 0;
  const runningTotals: { [accountId: string]: { value: number, previousTotal: number, type: string } } = {};
  // Running Receipts Total
  let lastDTotal = 0;
  // Running Non-Income Deposits Total
  let lastNDTotal = 0;

  const updateData: Update[] = []

  // TODO save calculated totals to each ledger in firestore
  // TODO reduce loop down to only relevant updated ledgers
  // each ledger will save the totals of the last ledger (for "Total up to this week" column)

  // TODO make sure accounts can't be used on different types

  console.log('original ledgers ==> ', currentLedgers)
  console.log('current ledger ==> ', currentLedger)
  // set in chronological order
  currentLedgers.sort(
    (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
  )

  // Knowing the index will allow us to determine how many Ledgers will need updating. i.e. update all future ledgers
  const ledgerIndex = currentLedgers.findIndex((l: Ledger) => l.id === currentLedger.id)

  console.log('ledgerIndex ==> ', ledgerIndex)

  for (let i = 0; i < currentLedgers.length; i++) {
    const l = currentLedgers[i]
    // if (i === 0) {
    //   // Start running balance with the first ledger's starting balance
    //   previousRunningBalance = currentFiscalYear.startingBalance || 0
    // } else {
    //   // All other ledgers need to adopt the new running balance
    //   l.startingBalance = previousRunningBalance
    // }
    console.log("currently looped ledger ==> ", l)
    // append running totals if not first ledger to record "total up to this week"
    // if (i > 0) { l.runningTotals = { ...runningTotals } }
    // for each ledger grab transactions and accumulate totals, oldest first, so the
    // Ledger sheet's register rows (written in this order, see updateSpreadsheet) match
    // the order entries were actually created rather than however Firestore returned them.
    const currentTransactions = transactions
      .filter(t => t.ledgerId === l.id)
      .sort((a, b) => toComparableTime(a.dateCreated) - toComparableTime(b.dateCreated))
    // The Ledger sheet's account-number column (J) needs each transaction's account
    // number, which lives on the Account, not the transaction (see findAccountById).
    const transactionsWithAccountNumber = currentTransactions.map(t => ({
      ...t,
      accountNumber: findAccountById(accounts, t.accountId)?.accountNumber ?? null,
    }))
    const currentLedgerUpdates: Update = { transactions: transactionsWithAccountNumber, fileId: l.fileId, 'E': [], 'NE': [], 'D': [], 'ND': [], lastDTotal, lastNDTotal, lastTotal }
    // Deposits/Non-Income Deposits list this ledger's own transactions chronologically,
    // rather than grouping by account like Expenses/Non-Deductible Expenses do.
    const depositItems: DepositUpdateItem[] = []
    const nonIncomeDepositItems: DepositUpdateItem[] = []
    console.log('current transactions ==> ', currentTransactions)
    currentTransactions.forEach(t => {
      const accId = t.accountId
      const currentAccount = findAccountById(accounts, accId)
      if (!currentAccount) return

      const accTypeCode = getAccountTypeCode(currentAccount)
      if (accTypeCode === "D") {
        lastDTotal = lastDTotal + t.value
        depositItems.push({ date: t.date, description: getDepositDescription(t.paidTo, t.memo), amount: t.value })
        return
      }
      if (accTypeCode === "ND") {
        lastNDTotal = lastNDTotal + t.value;
        nonIncomeDepositItems.push({ date: t.date, description: getDepositDescription(t.paidTo, t.memo), amount: t.value })
        return
      }

      runningTotals[accId] = runningTotals[accId]
        ? { ...runningTotals[accId], value: (runningTotals[accId].value) + t.value }
        : { value: t.value, type: accTypeCode, previousTotal: 0 }
    })

    currentLedgerUpdates.D = depositItems.sort((a, b) => toComparableTime(a.date) - toComparableTime(b.date))
    currentLedgerUpdates.ND = nonIncomeDepositItems.sort((a, b) => toComparableTime(a.date) - toComparableTime(b.date))

    // calculate new running balance
    const { totalBalanceIncludingPreviousBalance } = calculateTotals(currentTransactions, lastTotal, accounts)
    // update running balance
    lastTotal = totalBalanceIncludingPreviousBalance
    // also update new current ledger with new running balance
    // if (i === ledgerIndex) {
    //   newCurrentLedger.runningBalance = totalBalanceIncludingPreviousBalance
    // }
    // add updated ledger to new ledger array
    // newCurrentLedgers.push(l)

    // Create updateData for this ledger and transfer currentTotal to previousTotal and reset currentTotal
    // const newRunningTotals: { [accountId: string]: { value: number, previousTotal: number, type: string } } = {};
    Object.entries(runningTotals).forEach(([accId, accTotals]) => {
      const account = findAccountById(accounts, accId);

      if ((accTotals.type === 'E' || accTotals.type === 'NE') && isValidKey(accTotals.type) && account) {
        currentLedgerUpdates[accTotals.type].push({
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          value: accTotals.value,
          previousTotal: accTotals.previousTotal,
        })
      }
      runningTotals[accId] = { type: accTotals.type, value: 0, previousTotal: accTotals.value + accTotals.previousTotal }
    })

    updateData.push(currentLedgerUpdates)
  }

  // TODO add error messaging for going over space allotment in file for each transaction type

  // Only return current ledger and ledgers chronologically ascending
  // If there is no current ledger, return all
  return {
    updates: ledgerIndex >= 0 ? updateData.slice(ledgerIndex) : updateData,
  }
}

export const calculateTotals = (
  transactions: FirestoreTransaction[],
  startingBalance: number,
  accounts: FirestoreAccount[]
) => {
  let totalDeposits = 0;
  let totalNonIncomeDeposits = 0;
  let totalDeductibleExpenses = 0;
  let totalNonDeductibleExpenses = 0;
  let totalExpenses = 0;

  transactions.forEach(t => {
    const account = findAccountById(accounts, t.accountId);
    if (!account) return;

    if (account.type === 'deposit') {
      totalDeposits += t.value;
      if (account.subType === 'non-income') totalNonIncomeDeposits += t.value;
      return;
    }

    totalExpenses += t.value;
    if (account.subType === 'non-deductible') {
      totalNonDeductibleExpenses += t.value;
    } else {
      totalDeductibleExpenses += t.value;
    }
  });

  const totalIncome = totalDeposits - totalNonIncomeDeposits;

  const totalBalance = totalDeposits - totalExpenses;
  const totalBalanceExcludingNonIncomeAndNonDeductible =
    (totalDeposits - totalNonIncomeDeposits) - (totalExpenses - totalNonDeductibleExpenses);

  const totalBalanceIncludingPreviousBalance = startingBalance + totalDeposits - totalExpenses

  return {
    totalDeposits,
    totalNonIncomeDeposits,
    totalIncome,
    totalDeductibleExpenses,
    totalExpenses,
    totalBalance,
    totalNonDeductibleExpenses,
    totalBalanceExcludingNonIncomeAndNonDeductible,
    totalBalanceIncludingPreviousBalance
  }
}