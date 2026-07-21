import type { FirestoreTransaction } from "./transactionTypes";

type UpdateItem = {
  accountName: string;
  accountNumber: number;
  value: number;
  previousTotal: number;
};

// One row per transaction for the Deposits/Non-Income Deposits sections,
// which list chronologically rather than grouping by account.
export type DepositUpdateItem = {
  date: FirestoreTransaction['date'];
  description: string;
  amount: number;
};

export type Update = {
  transactions: FirestoreTransaction[];
  fileId: string;
  E: UpdateItem[];
  NE: UpdateItem[];
  D: DepositUpdateItem[];
  ND: DepositUpdateItem[];
  lastDTotal: number;
  lastNDTotal: number;
  lastTotal: number;
};

export const isValidKey = (key: string): key is 'E' | 'NE' | 'D' | 'ND' => {
  return ['E', 'NE', 'D', 'ND'].includes(key as any);
};