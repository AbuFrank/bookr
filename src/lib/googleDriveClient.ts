import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import type { Update } from '../types/spreadsheetTypes';
import type { Folder } from '../types/folderTypes';
import { createFirestoreFolder } from '../firebase/crud';

interface DriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  // ... other properties
}

interface GoogleDriveAPI {
  setCurrentUser: (user: User | null) => void;
  updateSheetCells: (updates: Update[]) => Promise<any>;
  // getAccessToken: () => Promise<string>;
  createFolder: (name: string, parentId: string) => Promise<Folder>;
  // storeAccessToken: (accessToken: string) => Promise<void>;
  // clearAccessToken: () => Promise<void>;
  // refreshAccessToken: () => Promise<string>;
  copyReportTemplate: (parentFolderId: string, fileName: string) => Promise<DriveFile>;
}

let currentUser: User | null = null
// let currentUserToken: string | null = null;


// Track authentication state to keep token updated
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    // Optionally refresh the token here
  } else {
    currentUser = null;
    // currentUserToken = null;
  }
});

const googleDriveAPI: GoogleDriveAPI = {
  setCurrentUser(user: User | null) {
    currentUser = user
  },

  async createFolder(name: string, parentId: string): Promise<Folder> {
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    // create top-level folder if no parentId
    const modifiedName = parentId ? name : `${currentUser.email?.split("@")[0]}-${currentUser.uid}`


    console.log('creating folder ==> ', `name: ${modifiedName}`, `parentId: ${parentId}`)
    try {
      // No folder ID exists, need to create it
      // const accessToken = await googleDriveAPI.getAccessToken();


      if (!currentUser?.email) {
        throw new Error('Missing user email')
      }

      const response = await fetch('/api/folder', {
        method: 'POST',
        headers: {
          // 'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modifiedName,
          parentId,
          userEmail: currentUser?.email,
        })
      });

      console.log('response status ', response.status)

      if (response.status === 401) {
        throw new Error('Token expired')
      }

      if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.status}`);
      }

      const folderData = await response.json();

      const folder: Folder = {
        id: folderData.id,
        dateCreated: new Date(),
        name: modifiedName,
        userId: currentUser.uid,
        parentId,
      }
      // Store the folder in Firestore
      createFirestoreFolder(folder)
      console.log('Created and stored folder:', folder);
      return folder
    } catch (error) {
      console.error('Error creating Bookr folder:', error);
      throw error;
    }
  },

  async copyReportTemplate(parentFolderId: string, fileName: string): Promise<DriveFile> {
    try {
      // const accessToken = await googleDriveAPI.getAccessToken();
      // const accessToken = await getAccessTokenWithRefresh()

      console.log('///////////////////')
      // console.log('accessToken ==> ', accessToken)
      console.log('current User ==> ', currentUser?.email)
      // TODO use `emailVerified` 

      if (!fileName) {
        throw new Error('Missing file name')
      }

      if (!currentUser?.email) {
        throw new Error('Missing user email')
      }

      const response = await fetch('/api/files/copy', {
        method: 'POST',
        headers: {
          // 'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          email: currentUser?.email,
          parentFolderId
        })
      });

      if (response.status === 401) {
        console.log('401 error caught...')
        throw new Error('Token expired')
      }

      if (!response.ok) {
        console.log(response)
        throw new Error(`Failed to copy file: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error copying template:', error);
      throw error;
    }
  },

  async updateSheetCells(updates: Update[]): Promise<void> {
    // If we don't have a user ID or token, try to get it from context
    try {
      console.log('no current userId found, fetching... ')

      // const accessToken = await googleDriveAPI.getAccessToken();

      console.log('///////////////////')
      // console.log('accessToken ==> ', accessToken)
      console.log('current User ==> ', currentUser?.email)
      // console.log('spreadsheetId ==> ', spreadsheetId)
      console.log('Updates ==> ', updates)

      console.log('update sheet cells server calling...')

      // TODO no longer need access token due to shared folder and reader access
      const response = await fetch(`/api/sheets/updates`, {
        method: 'PUT',
        headers: {
          // 'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates,
        })
      });

      console.log('//////////////////')
      console.log('updateSheetCells response ==> ', response)
    } catch (error) {
      console.error('Error updating spreadsheet:', error);
      throw error;
    }
  },

  // async getAccessToken(): Promise<string> {
  //   // TODO remove access token storage/retrieval in lieu of revalidate()
  //   // First try to use cached token
  //   if (currentUserToken && currentUser) {
  //     return currentUserToken;
  //   }

  //   if (!currentUser) {
  //     throw new Error('No authenticated user found');
  //   }

  //   // Get token from Firestore
  //   try {
  //     const userTokenRef = doc(db, 'userTokens', currentUser.uid);
  //     const tokenDoc = await getDoc(userTokenRef);

  //     if (tokenDoc.exists()) {
  //       const tokenData = tokenDoc.data();
  //       currentUserToken = tokenData.accessToken;
  //       return tokenData.accessToken;
  //     }
  //   } catch (error) {
  //     console.error('Error fetching token from Firestore:', error);
  //   }

  //   throw new Error('No access token found in Firestore');
  // },

  // async refreshAccessToken(): Promise<string> {

  //   // This would be your server-side endpoint to refresh tokens
  //   if (!currentUser) {
  //     throw new Error('No authenticated user found');
  //   }

  //   try {
  //     const response = await fetch('/api/auth/refresh-token', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ userId: currentUser })
  //     });

  //     if (!response.ok) {
  //       throw new Error('Failed to refresh token');
  //     }

  //     const { accessToken } = await response.json();
  //     await googleDriveAPI.storeAccessToken(accessToken);
  //     return accessToken;
  //   } catch (error) {
  //     console.error('Error refreshing token:', error);
  //     throw error;
  //   }
  // },

  // async storeAccessToken(accessToken: string): Promise<void> {
  //   if (!currentUser) {
  //     throw new Error('No authenticated user found');
  //   }

  //   try {
  //     const userTokenRef = doc(db, 'userTokens', currentUser.uid);
  //     await setDoc(userTokenRef, {
  //       accessToken,
  //       updatedAt: new Date()
  //     });
  //   } catch (error) {
  //     console.error('Error storing token in Firestore:', error);
  //     throw error;
  //   }
  // },

  // async clearAccessToken(): Promise<void> {
  //   if (!currentUser) {
  //     return;
  //   }

  //   try {
  //     const userTokenRef = doc(db, 'userTokens', currentUser.uid);
  //     await setDoc(userTokenRef, {
  //       accessToken: null,
  //       updatedAt: new Date()
  //     });
  //   } catch (error) {
  //     console.error('Error clearing token:', error);
  //   }
  // }
};

export default googleDriveAPI;
