import { db } from "../firebase/firebase";
import type { FirestoreAccount, FormAccountData } from "../types/accountTypes";
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
  console.log(`new id for collection "${collectionName}" created => `, doc(collectionRef).id)
  return doc(collectionRef).id;
};

/**
 * Creates an account label string from a FormAccountData object.
 *
 * @param account The FormAccountData object containing account details.
 * @returns The formatted account label string (e.g., "E3 - Mythical"). Returns an empty string if the account object is invalid.
 */
export const createAccountLabel = (account: FormAccountData): string => {
  if (!account || !account.accountType || !account.accountNumber || !account.accountName) {
    console.warn("Invalid account object provided. Label will not be created.");
    return "";
  }

  // Extract the first letter of the account type
  const typeInitial = account.accountType.charAt(0).toUpperCase();

  // Format the account number to always have two digits
  const formattedAccountNumber = account.accountNumber.padStart(2, '0');

  return `${typeInitial}${formattedAccountNumber} - ${account.accountName}`;
};