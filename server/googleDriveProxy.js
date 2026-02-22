import express from 'express';
import { getGoogleDriveClient, getServiceAccountDrive } from './googleAuth.js';
import path from 'path';

const router = express.Router();

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'server/.env.local') });

const templateId = process.env.GOOGLE_TEMPLATE_ID

console.log('templateId ===> ', templateId)

// Copy file from template to user's drive
router.post('/files/copy', getGoogleDriveClient, async (req, res) => {
  try {
    const { destinationFolderId, fileName, email } = req.body;

    console.log("API... ")
    console.log("templateId ==> ", templateId)
    console.log("destinationFolderId ==> ", destinationFolderId)
    console.log("fileName ==> ", fileName)
    console.log("email ==> ", email)

    if (!templateId) {
      return res.status(400).json({ error: 'Source file ID required' });
    }

    // Step 1: Grant access to the user for the template file
    const serviceAccountDrive = getServiceAccountDrive();

    console.log("attempting to give access to user, ", email)

    await serviceAccountDrive.drive.permissions.create({
      fileId: templateId,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: email
      }
    });

    console.log('added user to template file ==> ', email)

    // Step 2: Copy the file using service account (this ensures we can read it)
    const copyResponse = await req.drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: fileName || 'Copied Report',
        parents: destinationFolderId ? [destinationFolderId] : undefined
      }
    });

    console.log('file copied successfully...')

    const copiedFileId = copyResponse.data.id;

    // Step 3: Transfer ownership to the user (this requires the user to have edit access)
    await serviceAccountDrive.drive.permissions.create({
      fileId: copiedFileId,
      requestBody: {
        role: 'editor',
        type: 'user',
        emailAddress: email
      }
    });

    console.log('New file created with ownership ===> ', copyResponse.data);

    res.json(copyResponse.data);

    res.json(newFile.data);
  } catch (error) {
    console.error('Error copying file:', error);
    if (error.code === 400) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    if (error.code === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (error.code === 404) {
      return res.status(404).json({ error: 'Source file not found' });
    }
    res.status(500).json({ error: 'Failed to copy file' });
  }
});

// Update a cell in Google Sheet
router.put('/sheets/:fileId/values/:range', getGoogleDriveClient, async (req, res) => {
  try {
    const { fileId, range } = req.params;
    const { values } = req.body;

    if (!values || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Invalid values format' });
    }

    const response = await req.drive.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error updating sheet:', error);
    // Handle specific Google API errors
    if (error.code === 400) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    if (error.code === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (error.code === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to update sheet' });
  }
});

// Get file metadata
router.get('/files/:fileId', getGoogleDriveClient, async (req, res) => {
  try {
    const { fileId } = req.params;

    const response = await req.drive.files.get({
      fileId,
      fields: 'id,name,mimeType,modifiedTime'
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error getting file:', error);
    if (error.code === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// List files
router.get('/files', getGoogleDriveClient, async (req, res) => {
  try {
    const response = await req.drive.files.list({
      pageSize: 10,
      fields: 'files(id,name,mimeType,modifiedTime)'
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Get spreadsheet metadata
router.get('/sheets/:fileId', getGoogleDriveClient, async (req, res) => {
  try {
    const { fileId } = req.params;

    const response = await req.drive.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'properties,sheets'
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error getting spreadsheet:', error);
    res.status(500).json({ error: 'Failed to get spreadsheet' });
  }
});

export default router;