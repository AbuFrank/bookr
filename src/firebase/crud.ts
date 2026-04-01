import googleDriveAPI from '../lib/googleDriveClient';
import type { FirestoreAccount } from '../types/accountTypes';
import type { Folder } from '../types/folderTypes';
import type { FirestoreLedger } from '../types/ledgerTypes';
import type { FirestoreTransaction } from '../types/transactionTypes';
import { db } from './firebase'; // Assuming your firebase initialization is in firebase.ts
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

export async function createTransaction(transaction: FirestoreTransaction) {
  try {
    console.log('TRANSACTION ..... ', transaction)
    const transactionsCollection = collection(db, 'transactions'); // 'transactions' is the collection name
    await setDoc(doc(transactionsCollection, transaction.id), transaction);
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
    console.log('transactionId ==> ', transactionId)
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
    await setDoc(doc(accountsCollection, account.id), account);
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

// Drive Folders
export async function createFirestoreFolder(folder: Folder) {
  try {
    const foldersCollection = collection(db, 'folders');
    await setDoc(doc(foldersCollection, folder.id), folder);
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

export async function loadUserFolders(userId: string) {
  try {
    const foldersCollection = collection(db, 'folders');
    const q = query(foldersCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const loadedFolders: Folder[] = [];
    querySnapshot.forEach((doc) => {
      loadedFolders.push({ ...doc.data() } as Folder);
    });
    if (loadedFolders.length === 0) {
      const newFolder = await googleDriveAPI.createFolder("Bookr App", '')
      loadedFolders.push(newFolder)
    }
    return loadedFolders;
  } catch (error) {
    console.error('Error loading folders:', error);
    return [];
  }
}

export async function updateFolder(folder: Folder) {
  try {
    const folderDocRef = doc(db, 'folders', folder.id);
    await updateDoc(folderDocRef, { ...folder });
    console.log('Folder updated successfully!');
  } catch (error) {
    console.error('Error updating folder:', error);
    throw error;
  }
}

// Ledgers
export async function createLedger(ledger: FirestoreLedger) {
  await setDoc(doc(db, 'ledgers', ledger.id), ledger);
};

export const loadLedgers = async (userId: string): Promise<FirestoreLedger[]> => {
  const q = query(collection(db, 'ledgers'), where('userId', '==', userId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      dateCreated: data.dateCreated?.toDate?.() ?? new Date(),
    } as FirestoreLedger;
  });
};