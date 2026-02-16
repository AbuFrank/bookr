
export interface FormData {
  accountId: string,
  checkNumber: string,
  paidTo: string,
  value: string,
  date: Date,
  type: 'income' | 'expense'
}

export interface FirestoreTransaction {
  id: string;
  userId: string;
  checkNumber?: string;
  date: Date;
  dateCreated: Date;
  paidTo: string;
  accountId: string;
  value: number;
  type: 'expense' | 'income';
}

export const TransactionActions = {
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  UPDATE_TRANSACTION: 'UPDATE_TRANSACTION',
  DELETE_TRANSACTION: 'DELETE_TRANSACTION',
  SET_TRANSACTIONS: 'SET_TRANSACTIONS',
};