import { createContext, useState, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithGoogle,
  signOutUser,
} from '../firebase/authService';

import { listenToAuthState } from '../firebase/firebase';
import { transactionReducer } from '../reducer/transactionReducer';
import { createAccount, createTransaction, deleteFirestoreAccount, deleteFirestoreTransaction, loadAccounts, loadTransactions, loadUserFolders, updateFirestoreAccount, updateFirestoreTransaction } from '../firebase/crud';
import { TransactionActions, type FirestoreTransaction } from '../types/transactionTypes';
import accountReducer from '../reducer/accountReducer';
import { AccountActions, type FirestoreAccount } from '../types/accountTypes';
import googleDriveAPI from '../lib/googleDriveClient';
import { FolderActions, type Folder } from '../types/folderTypes';
import folderReducer from '../reducer/folderReducer';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  transactions: FirestoreTransaction[];
  addTransaction: (transaction: FirestoreTransaction) => void;
  updateTransaction: (updatedTransaction: FirestoreTransaction) => void;
  deleteTransaction: (transactionId: string) => void;
  accounts: FirestoreAccount[];
  accountsLoading: boolean;
  transactionsLoading: boolean;
  addAccount: (acount: FirestoreAccount) => void;
  updateAccount: (updatedAccount: FirestoreAccount) => void;
  deleteAccount: (accountId: string) => void;
  folders: Folder[];
  currentParentFolder: Folder;
  currentFolderChildren: Folder[];
  addFolder: (folder: Folder) => void;
  updateFolder: (folder: Folder) => void;
  deleteFolder: (folderId: string) => void;
  setCurrentFolderParent: (folder: Folder) => void;
  setFolders: (folders: Folder[]) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);
  const [transactionState, dispatchTransaction] = useReducer(transactionReducer, { transactions: [] });
  const [accountState, dispatchAccount] = useReducer(accountReducer, { accounts: [] })
  const [folderState, dispatchFolder] = useReducer(folderReducer, { folders: [], currentChildren: [], currentParent: {} });

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = listenToAuthState((firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        googleDriveAPI.setCurrentUser(firebaseUser);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          providerId: firebaseUser.providerId
        });
        setIsAuthenticated(true);


        try {
          // Load user data
          Promise.all([
            loadTransactions(firebaseUser.uid),
            loadAccounts(firebaseUser.uid),
            loadUserFolders(firebaseUser.uid),
          ])
            .then(([initialTransactions, initialAccounts, initialFolders]) => {
              dispatchTransaction({ type: TransactionActions.SET_TRANSACTIONS, payload: initialTransactions })
              dispatchAccount({ type: AccountActions.SET_ACCOUNTS, payload: initialAccounts })
              dispatchFolder({ type: FolderActions.SET_FOLDERS, payload: initialFolders })
              setLoading(false);
            })
        } catch (error) {
          console.error('Error during login flow:', error);
          setLoading(false);
        }
      } else {
        // User is signed out
        googleDriveAPI.setCurrentUser(null);
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const addTransaction = async (transaction: FirestoreTransaction) => {
    setTransactionsLoading(true)
    await createTransaction(transaction);
    dispatchTransaction({ type: TransactionActions.ADD_TRANSACTION, payload: transaction });
    setTransactionsLoading(false)
  };

  const updateTransaction = async (updatedTransaction: FirestoreTransaction) => {
    setTransactionsLoading(true)
    await updateFirestoreTransaction(updatedTransaction);
    dispatchTransaction({ type: TransactionActions.UPDATE_TRANSACTION, payload: updatedTransaction });
    setTransactionsLoading(false)
  };

  const deleteTransaction = async (transactionId: string) => {
    setTransactionsLoading(true)
    console.log('deleteTransaction running????????')
    await deleteFirestoreTransaction(transactionId)
    dispatchTransaction({ type: TransactionActions.DELETE_TRANSACTION, payload: transactionId });
    setTransactionsLoading(false)
  };

  const addAccount = async (account: FirestoreAccount) => {
    setAccountsLoading(true)
    await createAccount(account);
    dispatchAccount({ type: AccountActions.ADD_ACCOUNT, payload: account });
    setAccountsLoading(false)
  };

  const updateAccount = async (updatedAccount: FirestoreAccount) => {
    setAccountsLoading(true)
    await updateFirestoreAccount(updatedAccount);
    dispatchAccount({ type: AccountActions.UPDATE_ACCOUNT, payload: updatedAccount });
    setAccountsLoading(false)
  };

  const deleteAccount = async (accountId: string) => {
    setAccountsLoading(true)
    await deleteFirestoreAccount(accountId)
    dispatchAccount({ type: AccountActions.DELETE_ACCOUNT, payload: accountId });
    setAccountsLoading(false)
  };

  const addFolder = (folder: Folder) => {
    dispatchFolder({ type: FolderActions.ADD_FOLDER, payload: folder });
  };
  const updateFolder = (updatedFolder: Folder) => {
    dispatchFolder({ type: FolderActions.UPDATE_FOLDER, payload: updatedFolder });
  };
  const deleteFolder = (folderId: string) => {
    dispatchFolder({ type: FolderActions.DELETE_FOLDER, payload: folderId });
  };
  const setCurrentFolderParent = (folder: Folder) => {
    dispatchFolder({ type: FolderActions.SET_CURRENT_PARENT, payload: folder });
  };
  const setFolders = (newFolders: Folder[]) => {
    dispatchFolder({ types: FolderActions.SET_FOLDERS, payload: newFolders })
  }


  const loginWithGoogle = async (): Promise<void> => {
    try {
      await signInWithGoogle();
      // Auth state listener will handle the user update
    } catch (error: any) {
      throw new Error(error.message || 'Google login failed');
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOutUser();
      navigate('/login');
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    loginWithGoogle,
    logout,
    transactions: transactionState.transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    transactionsLoading,
    accounts: accountState.accounts,
    accountsLoading,
    addAccount,
    updateAccount,
    deleteAccount,
    folders: folderState.folders,
    currentParentFolder: folderState.currentParent,
    currentFolderChildren: folderState.currentChildren,
    addFolder,
    updateFolder,
    deleteFolder,
    setCurrentFolderParent,
    setFolders,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};