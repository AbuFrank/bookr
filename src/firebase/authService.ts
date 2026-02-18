import { auth, db, googleProvider } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
}

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Create user document if it doesn't exist
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName || 'Unknown',
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date(),
        lastLogin: new Date()
      });
    }

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};