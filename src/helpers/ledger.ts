import { findAccountById } from "../lib/firestore";
import type { FirestoreAccount } from "../types/accountTypes";
import type { Ledger } from "../types/ledgerTypes";
import { isValidKey, type Update } from "../types/spreadsheetTypes";
import type { FirestoreTransaction } from "../types/transactionTypes";



const getAccountType = (transaction: FirestoreTransaction) => {
  switch (true) {
    case transaction.type === 'expense' && !transaction.subType:
      return "E"
    case transaction.type === 'expense' && transaction.subType === 'non-deductible':
      return "NE"
    case transaction.type === 'deposit' && !transaction.subType:
      return "D"
    default:
      return "ND"
  }
}

// totals each account within each ledger; accumulating for each consecutive ledger.
export const calculateAccountTotals = (transactions: FirestoreTransaction[], currentLedger: Ledger, currentLedgers: Ledger[], accounts: FirestoreAccount[]) => {
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
    console.log("currently looped ledger ==> ", l)
    const currentLedgerUpdates: Update = { fileId: l.fileId, 'E': [], 'NE': [], 'D': [], 'ND': [], lastDTotal, lastNDTotal }
    // append running totals if not first ledger to record "total up to this week"
    // if (i > 0) { l.runningTotals = { ...runningTotals } }
    // for each ledger grab transactions and accumulate totals

    const currentTransactions = transactions.filter(t => t.ledgerId === l.id)
    // const currentTotals: { [accountId: string]: { value: number, type: string } } = {};
    console.log('current transactions ==> ', currentTransactions)
    currentTransactions.forEach(t => {
      const accId = t.accountId
      const accType = getAccountType(t)
      if (accType === "D") {
        lastDTotal = lastDTotal + t.value
      }
      if (accType === "ND") {
        lastNDTotal = lastNDTotal + t.value;
      }
      // const accName = findAccountById(accounts, t?.accountId)?.accountName;
      // if (!accName) return;
      runningTotals[accId] = runningTotals[accId]
        ? { ...runningTotals[accId], value: (runningTotals[accId].value) + t.value }
        : { value: t.value, type: accType, previousTotal: 0 }
    })

    // Create updateData for this ledger and transfer currentTotal to previousTotal and reset currentTotal
    // const newRunningTotals: { [accountId: string]: { value: number, previousTotal: number, type: string } } = {};
    Object.entries(runningTotals).forEach(([accId, accTotals]) => {
      const accName = findAccountById(accounts, accId)?.accountName || '';

      // In your forEach loop:
      if (isValidKey(accTotals.type)) {
        currentLedgerUpdates[accTotals.type].push({ accountName: accName, value: accTotals.value, previousTotal: accTotals.previousTotal })
      }
      runningTotals[accId] = { type: accTotals.type, value: 0, previousTotal: accTotals.value + accTotals.previousTotal }
    })

    updateData.push(currentLedgerUpdates)
  }

  // TODO add error messaging for going over space allotment in file for each transaction type

  // Only return current ledger and ledgers chronologically ascending
  // If there is no current ledger, return all
  return ledgerIndex >= 0 ? updateData.slice(ledgerIndex) : updateData
}

export const calculateTotals = (transactions: FirestoreTransaction[]) => {
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.value, 0);

  const totalNonIncomeDeposits = transactions
    .filter(t => t.type === 'deposit' && t.subType === 'non-income')
    .reduce((sum, t) => sum + t.value, 0);

  const totalIncome = totalDeposits - totalNonIncomeDeposits;

  const totalDeductibleExpenses = transactions
    .filter(t => t.type === 'expense' && (!t.subType || t.subType !== 'non-deductible'))
    .reduce((sum, t) => sum + t.value, 0);

  const totalNonDeductibleExpenses = transactions
    .filter(t => t.type === 'expense' && t.subType === 'non-deductible')
    .reduce((sum, t) => sum + t.value, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.value, 0);

  const totalBalance = totalDeposits - totalExpenses;
  const totalBalanceExcludingNonIncomeAndNonDeductible =
    (totalDeposits - totalNonIncomeDeposits) - (totalExpenses - totalNonDeductibleExpenses);

  return {
    totalDeposits,
    totalNonIncomeDeposits,
    totalIncome,
    totalDeductibleExpenses,
    totalExpenses,
    totalBalance,
    totalNonDeductibleExpenses,
    totalBalanceExcludingNonIncomeAndNonDeductible
  }
}