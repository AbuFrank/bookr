import type { FirestoreTransaction } from "../types/transactionTypes";

/**
 * Distinct, non-empty `paidTo` values across the given transactions, used to
 * power an autocomplete/history list on the "Payment To / Deposit From" field.
 */
export const getDistinctPaidTo = (transactions: FirestoreTransaction[]): string[] => {
  const values = transactions
    .map(t => t.paidTo?.trim())
    .filter((value): value is string => !!value);
  return Array.from(new Set(values)).sort();
};
