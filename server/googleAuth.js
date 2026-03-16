import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let serviceAccountClient = null;

// Get absolute path to service account key
const keyPath = path.join(process.cwd(), 'server/service-account-key.json');

// Service account that has access to the template file
export const getServiceAccountDrive = () => {
  if (!serviceAccountClient) {
    const keyFile = JSON.parse(
      fs.readFileSync(path.join(keyPath), 'utf8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
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

    // Copy the file directly using Google Drive API
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: fileName || 'Copied Report',
        parents: parentFolderId ? [parentFolderId] : []
      },
      supportsAllDrives: true,
      fields: 'id, webViewLink'
    });


    const newFileId = copyResponse.data.id;

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

// Batch update spreadsheet
export const updateBatchCells = async (fileId, updates) => {
  try {
    const { sheets } = getServiceAccountDrive();
    console.log('Updating sheet cells...');

    const fetchFileResponse = await sheets.spreadsheets.get({
      spreadsheetId: fileId
    });

    console.log('Available sheets:', fetchFileResponse.data.sheets);

    const sheetId = fetchFileResponse.data.sheets[0].properties.sheetId

    // Prepare the update requests
    const requests = updates.map(update => {
      const { column, values, startRow = 4 } = update; // Default to row 4 (0-indexed)

      // Convert 0-based indexing to 1-based for spreadsheet
      const startRowIndex = startRow;
      const endRowIndex = startRow + values.length;

      // Create rows for each "column" update
      const rows = values.map((value, index) => {
        // Handle different types of values
        let userEnteredValue;

        if (typeof value === 'number') {
          userEnteredValue = { numberValue: value };
        } else if (typeof value === 'string' && !isNaN(Number(value)) && isFinite(value)) {
          // If it's a string that represents a number
          userEnteredValue = { numberValue: Number(value) };
        } else {
          // Treat as text
          userEnteredValue = { stringValue: String(value) };
        }

        return {
          values: [
            {
              userEnteredValue
            }
          ]
        };
      });

      return {
        updateCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: startRowIndex,
            endRowIndex: endRowIndex,
            startColumnIndex: column,
            endColumnIndex: column + 1
          },
          rows: rows,
          fields: 'userEnteredValue'
        }
      };
    });

    // Execute the batch update
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileId,
      requestBody: {
        requests: requests
      }
    });

    console.log('Sheet updated successfully:', response.data);
    return response.data;

  } catch (error) {
    console.error('Error updating sheet cells:', error);
    throw error;
  }
};

// Function to get sheet information and sheet IDs
export const getSheetInfo = async (fileId) => {
  try {
    const { sheets } = getServiceAccountDrive();

    const response = await sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'sheets(properties)'
    });

    const sheetsInfo = response.data.sheets.map(sheet => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
      gridProperties: sheet.properties.gridProperties
    }));

    console.log('Sheet information:', sheetsInfo);
    return sheetsInfo;

  } catch (error) {
    console.error('Error getting sheet info:', error);
    throw error;
  }
};