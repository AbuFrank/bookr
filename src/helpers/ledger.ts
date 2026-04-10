import type { Ledger } from "../types/ledgerTypes";
import type { FirestoreTransaction } from "../types/transactionTypes";

// totals each account within each ledger; accumulating for each consecutive ledger.
export const calculateAccountTotals = (transactions: FirestoreTransaction[], currentLedger: Ledger, currentLedgers: Ledger[]) => {
  const runningTotals: { [accountId: string]: number } = {};

  const ledgerIndex = currentLedgers.findIndex(l => l.id === currentLedger.id)

  for (let i = 0; i < currentLedgers.length; i++) {
    const l = currentLedgers[i]
    // for each ledger grab transactions and calculate totals
    const currentTransactions = transactions.filter(t => t.ledgerId === l.id)
    currentTransactions.forEach(t => {
      const accId = t.accountId;
      if (!accId) return;
      runningTotals[accId] = (runningTotals[accId] || 0) + t.value;
    })
    l.runningTotals = runningTotals
  }
  // Only return current ledger and ledgers chronologically ascending
  // If there is no current ledger, return all
  return ledgerIndex >= 0 ? currentLedgers.slice(ledgerIndex) : currentLedgers
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