// export interface Transaction {
//   id: string;
//   paidTo: string;
//   accountNumber: string;
//   checkNumber?: string;
//   value: number;
//   type: 'income' | 'expense';
//   date: Date;
// }

export interface FirestoreTransaction {
  id: string;
  userId: string;
  checkNumber?: string;
  date: Date;
  dateCreated: Date;
  paidTo: string;
  accountNumber: string;
  value: number;
  type: 'expense' | 'income';
}

export const TransactionActions = {
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  UPDATE_TRANSACTION: 'UPDATE_TRANSACTION',
  DELETE_TRANSACTION: 'DELETE_TRANSACTION',
  SET_TRANSACTIONS: 'SET_TRANSACTIONS',
};