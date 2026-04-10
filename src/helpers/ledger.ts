import type { FirestoreLedger } from "../types/ledgerTypes";
import type { FirestoreTransaction } from "../types/transactionTypes";

// totals each account within each ledger; accumulating for each consecutive ledger.
export const calculateTotals = (transactions: FirestoreTransaction[], currentLedger: FirestoreLedger, currentLedgers: FirestoreLedger[]) => {
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