import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Readable } from 'node:stream';

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
    const { drive } = getServiceAccountDrive();
    console.log('copyTemplateFile...')

    // Export the Google Spreadsheet as XLSX
    const exportResponse = await drive.files.export({
      fileId: templateId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      supportsAllDrives: true
    });

    console.log('export response ==> ', exportResponse.data)
    console.log("export response type ==> ", typeof exportResponse.data)
    // Log the response with circular reference handling
    console.log('Full export response:', JSON.stringify(exportResponse, (key, value) => {
      if (value && typeof value === 'object' && value.constructor.name === 'Blob') {
        return '[Blob object - size: ' + (value.size || 'unknown') + ']';
      }
      if (value && typeof value === 'object' && value.constructor.name === 'Uint8Array') {
        return '[Uint8Array - length: ' + value.length + ']';
      }
      return value;
    }, 2));

    console.log('Export response details:');
    console.log('Status:', exportResponse.status);
    console.log('Status Text:', exportResponse.statusText);
    console.log('Headers:', exportResponse.headers);
    console.log('Data type:', typeof exportResponse.data);
    console.log('Data constructor:', exportResponse.data?.constructor?.name);
    console.log('Data keys (if object):', Object.keys(exportResponse.data || {}));

    const arrayBuffer = await exportResponse.data.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    console.log("arrayBuffer ==> ", arrayBuffer)
    console.log("fileBuffer ==>", fileBuffer)

    // Convert Buffer -> Readable stream
    const fileStream = Readable.from(fileBuffer);

    // Create new spreadsheet file with exported content
    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName || 'Copied Report',
        parents: [parentFolderId],
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: fileStream
      },
      supportsAllDrives: true,
      fields: 'id, webViewLink',
    });

    const newFileId = createResponse.data.id;

    console.log('newFileId ==> ', newFileId)

    // Set user permissions
    console.log('attempting file permissions for user ==> ', userEmail)
    await drive.permissions.create({
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
      fileUrl: `https://docs.google.com/document/d/${newFileId}/edit`
    };

  } catch (error) {
    console.error('Error in copyTemplateFile:', error);
    throw error;
  }
};