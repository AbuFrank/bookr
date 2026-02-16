export const AccountActions = {
  ADD_ACCOUNT: 'ADD_ACCOUNT',
  UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
  DELETE_ACCOUNT: 'DELETE_ACCOUNT',
  SET_ACCOUNTS: 'SET_ACCOUNTS',
}

export interface FirestoreAccount {
  dateCreated: Date;
  userId: string;
  id: string;
  accountType: string;
  accountNumber: string;
  accountName: string;
}


export interface FormAccountData {
  accountType: string;
  accountNumber: string;
  accountName: string;
}