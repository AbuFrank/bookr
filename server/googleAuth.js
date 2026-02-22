import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let serviceAccountClient = null;

// Get absolute path to service account key
const keyPath = path.join(process.cwd(), 'server/service-account-key.json');

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
      ]
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
