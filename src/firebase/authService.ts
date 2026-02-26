import { auth, db, googleProvider } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
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


    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken

    const refreshToken = result._tokenResponse.refreshToken;
    const expiresIn = result._tokenResponse.expiresIn;

    console.log('Result ==> ', result)
    console.log('access token ==> ', accessToken)
    console.log('Refresh Token ==> ', refreshToken)

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

    // Store the access token in Firestore
    if (accessToken) {
      const tokenRef = doc(db, 'userTokens', user.uid);
      await setDoc(tokenRef, {
        accessToken,
        refreshToken,
        expiresIn,
        updatedAt: new Date()
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


export const getUserAccessToken = async (userId: string): Promise<string | null> => {
  try {
    const tokenRef = doc(db, 'userTokens', userId);
    const tokenDoc = await getDoc(tokenRef);

    if (tokenDoc.exists()) {
      return tokenDoc.data().accessToken || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user access token:', error);
    return null;
  }
};