import { createContext, useContext, useState, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
} from '../firebase/authService';

import type { LoginCredentials, SignUpData } from '../firebase/authService';


import { listenToAuthState } from '../firebase/firebase';
import { transactionReducer } from '../reducer/transactionReducer';
import { createAccount, createTransaction, loadAccounts, loadTransactions } from '../firebase/crud';
import { TransactionActions, type FirestoreTransaction } from '../types/transactionTypes';
import accountReducer from '../reducer/accountReducer';
import { AccountActions, type FirestoreAccount } from '../types/accountTypes';

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
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: SignUpData) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  transactions: FirestoreTransaction[];
  addTransaction: (transaction: FirestoreTransaction) => void;
  updateTransaction: (updatedTransaction: FirestoreTransaction) => void;
  deleteTransaction: (transactionId: string) => void;
  accounts: FirestoreAccount[];
  addAccount: (acount: FirestoreAccount) => void;
  updateAccount: (updatedAccount: FirestoreAccount) => void;
  deleteAccount: (accountId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [transactionState, dispatchTransaction] = useReducer(transactionReducer, { transactions: [] });
  const [accountState, dispatchAccount] = useReducer(accountReducer, { accounts: [] })

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = listenToAuthState((firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          providerId: firebaseUser.providerId
        });
        const initialTransactions = loadTransactions(firebaseUser.uid);
        dispatchTransaction({ type: TransactionActions.SET_TRANSACTIONS, payload: initialTransactions })
        const initialAccounts = loadAccounts(firebaseUser.uid);
        dispatchAccount({ type: AccountActions.SET_ACCOUNTS, payload: initialAccounts })
        setIsAuthenticated(true);
        setLoading(false);
      } else {
        // User is signed out
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const addTransaction = async (transaction: FirestoreTransaction) => {
    setLoading(true)
    const newId = await createTransaction(transaction);
    dispatchTransaction({ type: TransactionActions.ADD_TRANSACTION, payload: { ...transaction, id: newId } });
    setLoading(false)
  };

  const updateTransaction = async (updatedTransaction: FirestoreTransaction) => {
    setLoading(true)
    await updateTransaction(updatedTransaction);
    dispatchTransaction({ type: TransactionActions.UPDATE_TRANSACTION, payload: updatedTransaction });
    setLoading(false)
  };

  const deleteTransaction = async (transactionId: string) => {
    setLoading(true)
    await deleteTransaction(transactionId)
    dispatchTransaction({ type: TransactionActions.DELETE_TRANSACTION, payload: transactionId });
    setLoading(false)
  };

  const addAccount = async (account: FirestoreAccount) => {
    setLoading(true)
    const newId = await createAccount(account);
    dispatchAccount({ type: AccountActions.ADD_ACCOUNT, payload: { ...account, id: newId } });
    setLoading(false)
  };

  const updateAccount = async (updatedAccount: FirestoreAccount) => {
    setLoading(true)
    await updateAccount(updatedAccount);
    dispatchAccount({ type: AccountActions.UPDATE_ACCOUNT, payload: updatedAccount });
    setLoading(false)
  };

  const deleteAccount = async (accountId: string) => {
    setLoading(true)
    await deleteAccount(accountId)
    dispatchAccount({ type: AccountActions.DELETE_ACCOUNT, payload: accountId });
    setLoading(false)
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      await signInWithEmail(credentials.email, credentials.password);
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (userData: SignUpData): Promise<void> => {
    try {
      const newUser = await signUpWithEmail(userData.email, userData.password, userData.displayName);
      setUser(newUser)
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
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
    login,
    register,
    loginWithGoogle,
    logout,
    transactions: transactionState.transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    accounts: accountState.accounts,
    addAccount,
    updateAccount,
    deleteAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};