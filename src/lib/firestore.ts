import { db } from "../firebase/firebase";
import type { FirestoreAccount } from "../types/accountTypes";
import { collection, doc } from 'firebase/firestore';

/**
 * Finds an account in an array of accounts by its ID.
 *
 * @param accounts An array of FirestoreAccount objects.
 * @param accountId The ID of the account to find.
 * @returns The FirestoreAccount object with the matching ID, or undefined if no match is found.
 */
export const findAccountById = (accounts: FirestoreAccount[], accountId: string): FirestoreAccount | undefined => {
  return accounts.find(account => account.id === accountId);
};


/**
 * Generates a unique ID for a Firestore document.
 *
 * @param collectionName The name of the Firestore collection.
 * @returns A unique string ID.
 */
export const generateFirestoreId = (collectionName: string): string => {
  const collectionRef = collection(db, collectionName);
  return doc(collectionRef).id;
};
