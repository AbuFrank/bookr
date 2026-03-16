import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from '../firebase/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { Update } from '../types/spreadsheetTypes';

interface DriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  // ... other properties
}

interface GoogleDriveAPI {
  setCurrentUser: (user: User | null) => void;
  updateSheetCells: (spreadsheetId: string, updates: Update[]) => Promise<any>;
  getAccessToken: () => Promise<string>;
  storeAccessToken: (accessToken: string) => Promise<void>;
  clearAccessToken: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
  copyReportTemplate: () => Promise<DriveFile>;
}

let currentUser: User | null = null
let currentUserToken: string | null = null;


// Track authentication state to keep token updated
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    // Optionally refresh the token here
  } else {
    currentUser = null;
    currentUserToken = null;
  }
});



const googleDriveAPI: GoogleDriveAPI = {
  setCurrentUser(user: User | null) {
    currentUser = user
  },

  async copyReportTemplate(destinationFolderId?: string): Promise<DriveFile> {
    try {
      const accessToken = await googleDriveAPI.getAccessToken();

      console.log('///////////////////')
      console.log('accessToken ==> ', accessToken)
      console.log('current User ==> ', currentUser?.email)
      // TODO use `emailVerified` 

      const response = await fetch('/api/files/copy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationFolderId,
          fileName: 'My Report TEST',
          email: currentUser?.email
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to copy file: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error copying template:', error);
      throw error;
    }
  },

  async updateSheetCells(spreadsheetId: string, updates: Update[]): Promise<void> {
    // If we don't have a user ID or token, try to get it from context
    try {
      console.log('no current userId found, fetching... ')

      const accessToken = await googleDriveAPI.getAccessToken();

      console.log('///////////////////')
      console.log('accessToken ==> ', accessToken)
      console.log('current User ==> ', currentUser?.email)
      console.log('spreadsheetId ==> ', spreadsheetId)
      console.log('Updates ==> ', updates)

      const response = await fetch(`/api/sheets/${spreadsheetId}/updates`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates,
        })
      });

      console.log('//////////////////')
      console.log('updateSheetCells response ==> ', response)
    } catch (error) {
      console.error('Error updating spreadsheet:', { error, spreadsheetId });
      throw error;
    }
  },

  async getAccessToken(): Promise<string> {

    // First try to use cached token
    if (currentUserToken && currentUser) {
      return currentUserToken;
    }

    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    // Get token from Firestore
    try {
      const userTokenRef = doc(db, 'userTokens', currentUser.uid);
      const tokenDoc = await getDoc(userTokenRef);

      if (tokenDoc.exists()) {
        const tokenData = tokenDoc.data();
        currentUserToken = tokenData.accessToken;
        return tokenData.accessToken;
      }
    } catch (error) {
      console.error('Error fetching token from Firestore:', error);
    }

    throw new Error('No access token found in Firestore');
  },

  async refreshAccessToken(): Promise<string> {

    // This would be your server-side endpoint to refresh tokens
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const { accessToken } = await response.json();
      await googleDriveAPI.storeAccessToken(accessToken);
      return accessToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  },

  async storeAccessToken(accessToken: string): Promise<void> {
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    try {
      const userTokenRef = doc(db, 'userTokens', currentUser.uid);
      await setDoc(userTokenRef, {
        accessToken,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error storing token in Firestore:', error);
      throw error;
    }
  },

  async clearAccessToken(): Promise<void> {
    if (!currentUser) {
      return;
    }

    try {
      const userTokenRef = doc(db, 'userTokens', currentUser.uid);
      await setDoc(userTokenRef, {
        accessToken: null,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }
};

export default googleDriveAPI;
