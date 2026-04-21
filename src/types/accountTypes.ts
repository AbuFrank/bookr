export const AccountActions = {
  ADD_ACCOUNT: 'ADD_ACCOUNT',
  UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
  DELETE_ACCOUNT: 'DELETE_ACCOUNT',
  SET_ACCOUNTS: 'SET_ACCOUNTS',
  SET_CURRENT_ACCOUNTS: 'SET_CURRENT_ACCOUNTS',
  RESET: 'RESET'
}

export interface FirestoreAccount {
  dateCreated: Date;
  userId: string;
  bookId: string;
  id: string;
  accountName: string;
}


export interface FormAccountData {
  accountName: string;
}