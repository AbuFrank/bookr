import { createContext, useContext, useState, useEffect } from 'react';
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};