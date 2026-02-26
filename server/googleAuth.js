import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let serviceAccountClient = null;
let appExpiryDate = null;
let appDriveClient = null;

// get env variables
dotenv.config({ path: path.join(process.cwd(), 'server/.env.local') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
const refreshToken = process.env.RT_REFRESH_TOKEN


// Get absolute path to service account key
const keyPath = path.join(process.cwd(), 'server/service-account-key.json');

// Generate auth url to retrieve access token
async function getRefreshToken() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Generate the authorization URL
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ],
    prompt: 'consent' // Forces consent screen to get refresh token
  });

  console.log('Visit this URL to authorize:', url);
}

// Service account that has access to the template file
export const getServiceAccountDrive = () => {
  if (!serviceAccountClient) {
    const keyFile = JSON.parse(
      fs.readFileSync(path.join(keyPath), 'utf8')
    );

    console.log('keyFile ==> ', keyFile.project_id)

    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });

    serviceAccountClient = {
      drive: google.drive({ version: 'v3', auth }),
      sheets: google.sheets({ version: 'v4', auth })
    }
  }

  return serviceAccountClient;
};

// Middleware to get Google Drive client (user context)
export const getGoogleDriveClient = async (req, res, next) => {
  try {
    // Get access token from request headers
    const accessToken = req.headers.authorization?.replace('Bearer ', '') ||
      req.body.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    console.log('middleware user ==> ', req.email);
    console.log('access token ==> ', accessToken)


    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    // Create drive client with user's credentials
    req.drive = google.drive({ version: 'v3', auth });
    req.spreadsheet = google.sheets({ version: 'v4', auth });

    next();
  } catch (error) {
    console.error('Error creating Google Drive client:', error);
    res.status(500).json({ error: 'Failed to create Google Drive client' });
  }
};

export const copyTemplateFile = async (templateId, fileName, userEmail, parentFolderId = null) => {
  try {
    // const { drive } = getServiceAccountDrive();
    console.log('copyTemplateFile...')

    // Check if access token is still valid
    const now = Math.floor(Date.now() / 1000);
    if (!appDriveClient || (appExpiryDate && appExpiryDate < now)) {
      console.log('No client or access token expired, refreshing...');
      const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
      );
      console.log('refresh token???? ', refreshToken)
      console.log('template id???? ', templateId)
      const tokenResponse = await oauth2Client.refreshToken(refreshToken)

      console.log('TOKENS >>> ', tokenResponse)
      // console.log('New access token:', tokens.access_token);
      // console.log('New expiry date:', tokens.expiry_date);
      // set credentials
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        expiry_date: tokens.expiry_date
      });
      appExpiryDate = tokens.expiry_date;
      // Create Drive API client
      appDriveClient = google.drive({
        version: 'v3',
        auth: oauth2Client
      });

    }


    console.log('attempting file copy...')
    const copyResponse = await appDriveClient.files.copy({
      fileId: templateId,
      requestBody: {
        name: fileName || 'Copied Report',
        parents: [parentFolderId]
      },
      supportsAllDrives: true
    });

    console.log('copied file response ==> ', copyResponse.data)

    const newFileId = copyResponse.data.id;

    // Set user permissions
    console.log('attempting file permissions for user ==> ', userEmail)
    await appDriveClient.permissions.create({
      fileId: newFileId,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: userEmail
      },
      supportsAllDrives: true
    });

    return {
      fileId: newFileId,
      fileUrl: `https://docs.google.com/document/d/${newFileId}/view`
    };

  } catch (error) {
    console.error('Error in copyTemplateFile:', error);
    throw error;
  }
};