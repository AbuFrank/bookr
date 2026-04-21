import { createContext, useState, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithGoogle,
  signOutUser,
} from '../firebase/authService';

import { listenToAuthState } from '../firebase/firebase';
import { transactionReducer } from '../reducer/transactionReducer';
import { createAccount, createLedger, createTransaction, deleteFirestoreAccount, deleteFirestoreTransaction, loadAccounts, loadLedgers, loadTransactions, loadUserFolders, updateFirestoreAccount, updateFirestoreTransaction } from '../firebase/crud';
import { TransactionActions, type FirestoreTransaction } from '../types/transactionTypes';
import accountReducer from '../reducer/accountReducer';
import { AccountActions, type FirestoreAccount } from '../types/accountTypes';
import googleDriveAPI from '../lib/googleDriveClient';
import { FolderActions, type Folder } from '../types/folderTypes';
import folderReducer from '../reducer/folderReducer';
import { LedgerActions, type LedgerInput, type Ledger } from '../types/ledgerTypes';
import ledgerReducer from '../reducer/ledgerReducer';

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
  transactionsLoading: boolean;
  transactions: FirestoreTransaction[];
  currentTransactions: FirestoreTransaction[];
  addTransaction: (transaction: FirestoreTransaction) => void;
  updateTransaction: (updatedTransaction: FirestoreTransaction) => void;
  deleteTransaction: (transactionId: string) => void;
  accounts: FirestoreAccount[];
  accountsLoading: boolean;
  addAccount: (acount: FirestoreAccount) => void;
  updateAccount: (updatedAccount: FirestoreAccount) => void;
  deleteAccount: (accountId: string) => void;
  ledgers: Ledger[];
  ledgersLoading: boolean;
  addLedger: (ledger: LedgerInput) => Promise<void>;
  setCurrentLedger: (ledger: Ledger) => void;
  currentLedger: Ledger | null;
  currentLedgers: Ledger[] | [];
  folders: Folder[];
  currentBook: Folder | null;
  currentFiscalYear: Folder | null;
  currentFolderChildren: Folder[];
  addFolder: (folder: Folder) => void;
  updateFolder: (folder: Folder) => void;
  deleteFolder: (folderId: string) => void;
  setCurrentFiscalYear: (folder: Folder) => void;
  setCurrentBook: (folder: Folder) => void;
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
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);
  const [transactionState, dispatchTransaction] = useReducer(transactionReducer, { transactions: [], currentTransactions: [] });
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [accountState, dispatchAccount] = useReducer(accountReducer, { accounts: [], currentAccounts: [] })
  const [ledgersLoading, setLedgersLoading] = useState<boolean>(false);
  const [ledgerState, dispatchLedger] = useReducer(ledgerReducer, {
    ledgers: [],
    currentLedgers: [],
    currentLedger: null,
  });
  const [folderState, dispatchFolder] = useReducer(folderReducer, {
    folders: [],
    currentChildren: [],
    currentYear: null,
    currentBook: null,
  });

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
            loadLedgers(firebaseUser.uid),
            loadUserFolders(firebaseUser.uid),
          ])
            .then(([initialTransactions, initialAccounts, initialLedgers, initialFolders]) => {
              dispatchTransaction({ type: TransactionActions.SET_TRANSACTIONS, payload: initialTransactions })
              dispatchAccount({ type: AccountActions.SET_ACCOUNTS, payload: initialAccounts })
              dispatchLedger({ type: LedgerActions.SET_LEDGERS, payload: initialLedgers })
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

  useEffect(() => {
    console.log('new current year => ', folderState.currentYear)
    if (!folderState?.currentYear?.id || !ledgerState?.ledgers?.length) {
      return
    }
    console.log('have fiscal year, book, and ledgers...')

    // Set current ledgers based on current folder parent
    // Set current ledger to most recent by default
    const fiscalYearLedgers = ledgerState.ledgers.filter(ledger => ledger.parentFolderId === folderState?.currentYear?.id)
    const dateDescendingLedgers = fiscalYearLedgers.sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    )
    console.log("current ledgers ==> ", dateDescendingLedgers)
    dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGERS, payload: dateDescendingLedgers })
    dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGER, payload: dateDescendingLedgers[0] })

  }, [folderState.currentYear, ledgerState.ledgers])

  useEffect(() => {
    console.log('new current book accounts useEffect triggered => ', { currentBook: folderState.currentBook })
    if (!folderState.currentBook?.id || !accountState.accounts.length) {
      console.log('no current book or accounts')
      return
    }

    // Set current accounts based on current book
    const bookAccounts = accountState.accounts.filter((account: FirestoreAccount) => account.bookId === folderState.currentBook?.id)
    dispatchAccount({ type: AccountActions.SET_CURRENT_ACCOUNTS, payload: bookAccounts })

  }, [folderState.currentBook, accountState.accounts])

  useEffect(() => {
    if (ledgerState.currentLedger) {

      const currentLedgerTransactions = transactionState.transactions.filter(t => t.ledgerId === ledgerState.currentLedger.id)
      dispatchTransaction({ type: TransactionActions.SET_CURRENT_TRANSACTIONS, payload: currentLedgerTransactions })
    }
  }, [transactionState.transactions, ledgerState.currentLedger])

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
  const setCurrentFiscalYear = (folder: Folder) => {
    dispatchFolder({ type: FolderActions.SET_CURRENT_YEAR, payload: folder });
  };
  const setCurrentBook = (folder: Folder) => {
    dispatchFolder({ type: FolderActions.SET_CURRENT_BOOK, payload: folder });
  };
  const setFolders = (newFolders: Folder[]) => {
    dispatchFolder({ type: FolderActions.SET_FOLDERS, payload: newFolders })
  }

  const addLedger = async (ledger: LedgerInput) => {
    setLedgersLoading(true);
    // Copy google spreadsheet from template
    try {
      const copiedFile = await googleDriveAPI.copyReportTemplate(ledger.parentFolderId, ledger.name)

      console.log('copy file success!!!!!!! ==> ', copiedFile)

      const fileId = copiedFile.fileId

      const newLedger = { ...ledger, fileId }
      // create Firestore entry
      await createLedger(newLedger);

      dispatchLedger({ type: LedgerActions.ADD_LEDGER, payload: newLedger });
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGER, payload: newLedger })
      setLedgersLoading(false);
    } catch (err: any) {
      console.log('auth context ledger error caught....', err)
      setLedgersLoading(false);
      if (err.message) {
        throw new Error(err.message)
      } else {
        throw new Error("Unknown error in createLedger()")
      }
    }
  };

  const setCurrentLedger = (ledger: Ledger) => {
    console.log('set current ledger triggered==> ', ledger)
    dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGER, payload: ledger });
  };


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
    currentTransactions: transactionState.currentTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    transactionsLoading,
    accounts: accountState.accounts,
    accountsLoading,
    addAccount,
    updateAccount,
    deleteAccount,
    ledgersLoading,
    currentLedger: ledgerState.currentLedger,
    currentLedgers: ledgerState.currentLedgers,
    ledgers: ledgerState.currentLedgers,
    addLedger,
    setCurrentLedger,
    folders: folderState.folders,
    currentFiscalYear: folderState.currentYear,
    currentBook: folderState.currentBook,
    currentFolderChildren: folderState.currentChildren,
    addFolder,
    updateFolder,
    deleteFolder,
    setCurrentFiscalYear,
    setCurrentBook,
    setFolders,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};