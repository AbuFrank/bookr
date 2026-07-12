export const AccountActions = {
  ADD_ACCOUNT: 'ADD_ACCOUNT',
  UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
  DELETE_ACCOUNT: 'DELETE_ACCOUNT',
  SET_ACCOUNTS: 'SET_ACCOUNTS',
  SET_CURRENT_ACCOUNTS: 'SET_CURRENT_ACCOUNTS',
  RESET: 'RESET'
}

export interface FirestoreAccount {
  accountName: string;
  accountNumber: number;
  dateCreated: Date;
  userId: string;
  bookId: string;
  id: string;
  type: 'deposit' | 'expense',
  subType: 'non-deductible' | 'non-income' | null
}


export interface FormAccountData {
  accountName: string;
  accountNumber: number | null;
  type: 'deposit' | 'expense' | null,
  subType: 'non-deductible' | 'non-income' | null
}