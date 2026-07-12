
export interface FormData {
  accountId: string,
  checkNumber: string,
  paidTo: string,
  value: string,
  date: Date,
  type: 'deposit' | 'expense',
  subType?: 'non-deductible' | 'non-income'
}

export interface FirestoreTransaction {
  id: string;
  userId: string;
  checkNumber?: string;
  date: Date;
  dateCreated: Date;
  paidTo: string;
  accountId: string;
  ledgerId: string | null;
  value: number;
  // type: 'expense' | 'deposit';
  // subType: 'non-deductible' | 'non-income' | null
}

export const TransactionActions = {
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  UPDATE_TRANSACTION: 'UPDATE_TRANSACTION',
  DELETE_TRANSACTION: 'DELETE_TRANSACTION',
  SET_TRANSACTIONS: 'SET_TRANSACTIONS',
  SET_CURRENT_TRANSACTIONS: 'SET_CURRENT_TRANSACTIONS',
  RESET: 'RESET'
};