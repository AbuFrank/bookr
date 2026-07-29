import { createContext, useState, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithGoogle,
  signOutUser,
} from '../firebase/authService';

import { listenToAuthState } from '../firebase/firebase';
import { transactionReducer } from '../reducer/transactionReducer';
import { createAccount, createLedger, createTransaction, deleteFirestoreAccount, deleteFirestoreTransaction, loadAccounts, loadLedgers, loadTransactions, loadUserFolders, updateFirestoreAccount, updateFirestoreTransaction, updateFolder as updateFirestoreFolder, updateLedger as updateFirestoreLedger } from '../firebase/crud';
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
  hasUnsavedReportChanges: boolean;
  markReportSaved: () => void;
  accounts: FirestoreAccount[];
  accountsLoading: boolean;
  addAccount: (acount: FirestoreAccount) => void;
  updateAccount: (updatedAccount: FirestoreAccount) => void;
  updateBooks: (groupFolder: Folder, yearFolder: Folder) => void;
  deleteAccount: (accountId: string) => void;
  ledgers: Ledger[];
  ledgersLoading: boolean;
  addLedger: (ledger: LedgerInput) => Promise<void>;
  updateLedger: (ledger: Ledger) => Promise<void>;
  setCurrentLedger: (ledger: Ledger) => void;
  currentLedger: Ledger | null;
  currentLedgers: Ledger[] | [];
  folders: Folder[];
  currentBook: Folder | null;
  currentFiscalYear: Folder | null;
  currentFolderChildren: Folder[];
  addFolder: (folder: Folder) => void;
  updateFolder: (folder: Folder) => Promise<void>;
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
  const [hasUnsavedReportChanges, setHasUnsavedReportChanges] = useState<boolean>(false);
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
    const currentLedgerTransactions = transactionState.transactions.filter(t => t.ledgerId === ledgerState.currentLedger?.id)
    dispatchTransaction({ type: TransactionActions.SET_CURRENT_TRANSACTIONS, payload: currentLedgerTransactions })
  }, [transactionState.transactions, ledgerState.currentLedger])

  const addTransaction = async (transaction: FirestoreTransaction) => {
    setTransactionsLoading(true)
    await createTransaction(transaction);
    dispatchTransaction({ type: TransactionActions.ADD_TRANSACTION, payload: transaction });
    setHasUnsavedReportChanges(true)
    setTransactionsLoading(false)
  };

  const updateTransaction = async (updatedTransaction: FirestoreTransaction) => {
    setTransactionsLoading(true)
    await updateFirestoreTransaction(updatedTransaction);
    dispatchTransaction({ type: TransactionActions.UPDATE_TRANSACTION, payload: updatedTransaction });
    setHasUnsavedReportChanges(true)
    setTransactionsLoading(false)
  };

  const deleteTransaction = async (transactionId: string) => {
    setTransactionsLoading(true)
    await deleteFirestoreTransaction(transactionId)
    dispatchTransaction({ type: TransactionActions.DELETE_TRANSACTION, payload: transactionId });
    setHasUnsavedReportChanges(true)
    setTransactionsLoading(false)
  };

  const markReportSaved = () => {
    setHasUnsavedReportChanges(false)
  };

  const addAccount = async (account: FirestoreAccount) => {
    setAccountsLoading(true)
    await createAccount(account);
    dispatchAccount({ type: AccountActions.ADD_ACCOUNT, payload: account });
    // ADD_ACCOUNT only updates `accounts`; the book-scoped `currentAccounts` list
    // (what forms actually read - see `accounts` below) needs its own refresh too,
    // otherwise a newly created account doesn't appear until the next updateBooks() call.
    if (account.bookId === folderState.currentBook?.id) {
      dispatchAccount({
        type: AccountActions.SET_CURRENT_ACCOUNTS,
        payload: [...accountState.currentAccounts, account],
      });
    }
    setAccountsLoading(false)
  };

  const updateAccount = async (updatedAccount: FirestoreAccount) => {
    setAccountsLoading(true)
    await updateFirestoreAccount(updatedAccount);
    dispatchAccount({ type: AccountActions.UPDATE_ACCOUNT, payload: updatedAccount });
    dispatchAccount({
      type: AccountActions.SET_CURRENT_ACCOUNTS,
      payload: accountState.currentAccounts.map((account: FirestoreAccount) => account.id === updatedAccount.id ? updatedAccount : account),
    });
    setAccountsLoading(false)
  };

  const updateBooks = async (groupFolder: Folder, yearFolder: Folder) => {
    // Set current accounts based on current book
    const bookAccounts = accountState.accounts.filter((account: FirestoreAccount) => account.bookId === groupFolder.id)
    dispatchAccount({ type: AccountActions.SET_CURRENT_ACCOUNTS, payload: bookAccounts })

    // Set current ledger to most recent by default
    const fiscalYearLedgers = ledgerState.ledgers.filter(ledger => ledger.parentFolderId === yearFolder.id)

    if (fiscalYearLedgers.length > 0) {
      const dateDescendingLedgers = fiscalYearLedgers.sort(
        (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      )
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGERS, payload: dateDescendingLedgers })
      // Set first ledger in list as current ledger
      const currentLedger = dateDescendingLedgers[0]
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGER, payload: currentLedger })

    } else {
      // reset current ledgers
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGERS, payload: [] })
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGER, payload: null })
    }
  }

  const deleteAccount = async (accountId: string) => {
    setAccountsLoading(true)
    await deleteFirestoreAccount(accountId)
    dispatchAccount({ type: AccountActions.DELETE_ACCOUNT, payload: accountId });
    dispatchAccount({
      type: AccountActions.SET_CURRENT_ACCOUNTS,
      payload: accountState.currentAccounts.filter((account: FirestoreAccount) => account.id !== accountId),
    });
    setAccountsLoading(false)
  };

  const addFolder = (folder: Folder) => {
    dispatchFolder({ type: FolderActions.ADD_FOLDER, payload: folder });
  };
  const updateFolder = async (updatedFolder: Folder) => {
    await updateFirestoreFolder(updatedFolder);
    dispatchFolder({ type: FolderActions.UPDATE_FOLDER, payload: updatedFolder });
    // A fiscal year's startingBalance seeds the running total of its
    // chronologically-first ledger (see calculateAccountTotals), so changing
    // it makes the Google Sheet report stale just like a transaction edit.
    setHasUnsavedReportChanges(true)
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
      const copiedFile = await googleDriveAPI.copyReportTemplate(ledger.parentFolderId, ledger.name, ledger.description)

      const fileId = copiedFile.fileId

      const newLedger = { ...ledger, fileId }
      // create Firestore entry
      await createLedger(newLedger);

      dispatchLedger({ type: LedgerActions.ADD_LEDGER, payload: newLedger });
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGERS, payload: [...ledgerState.currentLedgers, newLedger] })
      dispatchLedger({ type: LedgerActions.SET_CURRENT_LEDGER, payload: newLedger })
      setLedgersLoading(false);
    } catch (err: any) {
      setLedgersLoading(false);
      if (err.message) {
        throw new Error(err.message)
      } else {
        throw new Error("Unknown error in createLedger()")
      }
    }
  };

  const updateLedger = async (updatedLedger: Ledger) => {
    setLedgersLoading(true);
    await updateFirestoreLedger(updatedLedger);
    dispatchLedger({ type: LedgerActions.UPDATE_LEDGER, payload: updatedLedger });
    // UPDATE_LEDGER only updates `ledgers`/`currentLedger`; the sidebar list
    // (`currentLedgers`, filtered per fiscal year) needs its own refresh too.
    dispatchLedger({
      type: LedgerActions.SET_CURRENT_LEDGERS,
      payload: ledgerState.currentLedgers.map(ledger => ledger.id === updatedLedger.id ? updatedLedger : ledger),
    });
    setLedgersLoading(false);
  };

  const setCurrentLedger = (ledger: Ledger) => {
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
      // Reset all state to initial values
      dispatchTransaction({ type: TransactionActions.RESET, payload: undefined });
      dispatchAccount({ type: AccountActions.RESET, payload: undefined });
      dispatchLedger({ type: LedgerActions.RESET, payload: undefined });
      dispatchFolder({ type: FolderActions.RESET, payload: undefined });
      setHasUnsavedReportChanges(false);

      // Reset user and auth state
      setUser(null);
      setIsAuthenticated(false);
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
    hasUnsavedReportChanges,
    markReportSaved,
    transactionsLoading,
    accounts: accountState.currentAccounts,
    accountsLoading,
    addAccount,
    updateAccount,
    updateBooks,
    deleteAccount,
    ledgersLoading,
    currentLedger: ledgerState.currentLedger,
    currentLedgers: ledgerState.currentLedgers,
    ledgers: ledgerState.currentLedgers,
    addLedger,
    updateLedger,
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