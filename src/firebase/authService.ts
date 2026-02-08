import { auth, db, googleProvider } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
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

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<User> => {

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update the Firebase user's display name
    await updateProfile(user, {
      displayName: displayName
    });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      displayName,
      email,
      createdAt: new Date(),
      lastLogin: new Date()
    });

    return { ...user, displayName };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

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