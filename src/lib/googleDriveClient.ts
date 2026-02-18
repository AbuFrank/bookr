import { auth, db } from '../firebase/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface GoogleDriveAPI {
  setCurrentUser: (userId: string | null) => void;
  updateSheetCell: (spreadsheetId: string, range: string, value: any) => Promise<any>;
  getAccessToken: () => Promise<string>;
  storeAccessToken: (accessToken: string) => Promise<void>;
  clearAccessToken: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
}

let currentUserId: string | null = null;

const googleDriveAPI: GoogleDriveAPI = {
  setCurrentUser(userId: string | null) {
    currentUserId = userId;
  },

  async updateSheetCell(spreadsheetId: string, range: string, value: any): Promise<any> {
    const token = await googleDriveAPI.getAccessToken();

    // Use your server URL - this will be different in dev vs production
    let baseUrl = '';
    if (import.meta.env.DEV) {
      console.log('running on dev server...')
      baseUrl = 'http://localhost:3001';
    } else {
      console.log('no dev meta found, assuming Prod')
      baseUrl = ''; // Will use relative paths in production
    }

    const response = await fetch(`${baseUrl}/api/sheets/${spreadsheetId}/values/${range}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        values: [[value]]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  async getAccessToken(): Promise<string> {
    if (!currentUserId) {
      throw new Error('No authenticated user found');
    }

    // Get token from Firestore
    try {
      const userTokenRef = doc(db, 'userTokens', currentUserId);
      const tokenDoc = await getDoc(userTokenRef);

      if (tokenDoc.exists()) {
        const tokenData = tokenDoc.data();
        return tokenData.accessToken;
      }
    } catch (error) {
      console.error('Error fetching token from Firestore:', error);
    }

    throw new Error('No access token found in Firestore');
  },

  async refreshAccessToken(): Promise<string> {
    // This would be your server-side endpoint to refresh tokens
    if (!currentUserId) {
      throw new Error('No authenticated user found');
    }

    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUserId })
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
    if (!currentUserId) {
      throw new Error('No authenticated user found');
    }

    try {
      const userTokenRef = doc(db, 'userTokens', currentUserId);
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
    if (!currentUserId) {
      return;
    }

    try {
      const userTokenRef = doc(db, 'userTokens', currentUserId);
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