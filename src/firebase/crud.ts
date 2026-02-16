import type { FirestoreAccount } from '../types/accountTypes';
import type { FirestoreTransaction } from '../types/transactionTypes';
import { db } from './firebase'; // Assuming your firebase initialization is in firebase.ts
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';

export async function createTransaction(transaction: FirestoreTransaction) {
  try {
    const transactionsCollection = collection(db, 'transactions'); // 'transactions' is the collection name
    await addDoc(transactionsCollection, transaction);
  } catch (error) {
    console.error('Error saving transaction:', error);
  }
}

export async function loadTransactions(userId: string) {
  try {
    const transactionsCollection = collection(db, 'transactions');
    const q = query(transactionsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const loadedTransactions: FirestoreTransaction[] = [];
    querySnapshot.forEach((doc) => {
      loadedTransactions.push({ ...doc.data() } as FirestoreTransaction);
    });
    return loadedTransactions;
  } catch (error) {
    console.error('Error loading transactions:', error);
  }
};

export async function updateFirestoreTransaction(transaction: FirestoreTransaction) {
  try {
    const transactionDocRef = doc(db, 'transactions', transaction.id);
    await updateDoc(transactionDocRef, { ...transaction });
    console.log('Transaction updated successfully!');
  } catch (error) {
    console.error('Error updating transaction:', error);
  }
}

export async function deleteFirestoreTransaction(transactionId: string) {
  try {
    const transactionDocRef = doc(db, 'transactions', transactionId);
    await deleteDoc(transactionDocRef);
    console.log('Transaction deleted successfully!');
  } catch (error) {
    console.error('Error deleting transaction:', error);
  }
}

// Accounts

export async function createAccount(account: FirestoreAccount) {
  try {
    console.log('creating a new account ====>', account)
    const accountsCollection = collection(db, 'accounts');
    await addDoc(accountsCollection, { ...account });
  } catch (error) {
    console.error('Error creating account:', error);
  }
}

export async function loadAccounts(userId: string) {
  try {
    const accountsCollection = collection(db, 'accounts');
    const q = query(accountsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const loadedAccounts: FirestoreAccount[] = [];
    querySnapshot.forEach((doc) => {
      loadedAccounts.push({ ...doc.data() } as FirestoreAccount);
    });
    return loadedAccounts;
  } catch (error) {
    console.error('Error loading accounts:', error);
    return []; // Return an empty array on error to prevent crashes
  }
}

export async function updateFirestoreAccount(account: FirestoreAccount) {
  try {
    const accountDocRef = doc(db, 'accounts', account.id);
    await updateDoc(accountDocRef, { ...account });
    console.log('Account updated successfully!');
  } catch (error) {
    console.error('Error updating account:', error);
  }
}

export async function deleteFirestoreAccount(accountId: string) {
  try {
    const accountDocRef = doc(db, 'accounts', accountId);
    await deleteDoc(accountDocRef);
    console.log('Account deleted successfully!');
  } catch (error) {
    console.error('Error deleting account:', error);
  }
}