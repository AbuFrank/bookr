import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let serviceAccountClient = null;

// Get absolute path to service account key
const keyPath = path.join(process.cwd(), 'server/cfcc-service-account-key.json');

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

export const createFolder = async (name, userEmail, sharedFolderId, parentId) => {
  try {
    console.log('createFolder fired... ', { name, userEmail, sharedFolderId, parentId })
    const { drive } = getServiceAccountDrive();

    // Check for existence
    // Verify the shared folder exists first
    try {
      const response = await drive.files.get({
        fileId: sharedFolderId,
        supportsAllDrives: true
      });

      console.log('Shared folder exists and is accessible');
      console.log(response.data)
    } catch (error) {
      console.error('Shared folder not accessible:', error.message);
      throw new Error(`Shared folder not accessible: ${sharedFolderId}`);
    }

    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [sharedFolderId]
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    console.log('attempting folder permissions for bookr manager...', response.data.id)
    const newFolderId = response.data.id

    console.log('email address ==> ', userEmail)

    // Only give read access if not top-level folder
    if (parentId) {
      await drive.permissions.create({
        fileId: newFolderId,
        requestBody: {
          role: 'reader',
          type: 'user',
          emailAddress: userEmail
        },
        supportsAllDrives: true
      });
    }
    return response.data
  } catch (error) {
    console.error('Error in createFolder:', error);
    throw error;
  }
}

export const copyTemplateFile = async (templateId, fileName, userEmail, sharedFolderId, parentFolderId = null) => {
  try {
    const { drive } = getServiceAccountDrive();
    console.log('copyTemplateFile...')

    console.log('parent folder id', parentFolderId)

    // Copy the file directly using Google Drive API
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: fileName || 'Copied Report',
        parents: [parentFolderId]
      },
      supportsAllDrives: true,
      fields: 'id, webViewLink'
    });


    const newFileId = copyResponse.data.id;
    // const newFileId = "12h8KZdEp0L26ByrbOZKfr5Y05JDIBixj_y8Mht-Gp78"
    // const tempFolderId = "1XQcAW_EA32YWuCvGOs78QrSbFG2lz6RX"

    console.log('newFileId ==> ', newFileId)

    console.log('attempting file permissions for user ==> ', userEmail)
    await drive.permissions.create({
      fileId: newFileId,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: userEmail
      },
      supportsAllDrives: true,
    });

    console.log('Attempting file transfer of new file with ID: ', newFileId)

    // await drive.files.update({
    //   fileId: newFileId,
    //   addParents: parentFolderId,
    //   removeParents: sharedFolderId,
    //   supportsAllDrives: true,
    //   fields: 'id, parents'
    // });
    // console.log('File moved to parent folder:', parentFolderId);
    // Set user permissions

    // Set user permissions
    // console.log('attempting file permissions for user ==> ', userEmail)
    // await drive.permissions.create({
    //   fileId: newFileId,
    //   requestBody: {
    //     role: 'writer',
    //     type: 'user',
    //     emailAddress: userEmail,
    //   },
    //   supportsAllDrives: true,
    // });

    // await drive.files.update({
    //   fileId: newFileId,
    //   addParents: parentFolderId,
    //   supportsAllDrives: true,
    //   fields: 'id, parents'
    // });
    // console.log('File moved to parent folder:', parentFolderId);

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