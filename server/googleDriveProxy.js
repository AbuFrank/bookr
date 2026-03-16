import express from 'express';
import { copyTemplateFile, getGoogleDriveClient, updateBatchCells } from './googleAuth.js';
import path from 'path';

const router = express.Router();

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'server/.env.local') });

const templateId = process.env.GOOGLE_TEMPLATE_ID
const parentFolderId = process.env.GOOGLE_PARENT_FOLDER_ID

console.log('templateId ===> ', templateId)

// Route to initiate Google OAuth2 flow
router.get('/auth/google', (req, res) => {
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ],
      prompt: 'consent'
    });

    console.log('Authorization URL:', url);

    // Redirect user to Google OAuth2 consent page
    res.redirect(url);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
});
// Copy file from template to user's drive
router.post('/files/copy', getGoogleDriveClient, async (req, res) => {
  try {
    const { fileName, email } = req.body;

    console.log("API... ")
    console.log("templateId ==> ", templateId)
    console.log("fileName ==> ", fileName)
    console.log("email ==> ", email)
    console.log("parent folder id ===> ", parentFolderId)

    if (!templateId) {
      return res.status(400).json({ error: 'No template file found.' });
    }

    if (!email) {
      return res.status(400).json({
        error: 'user email is required'
      });
    }

    const result = await copyTemplateFile(
      templateId,
      fileName,
      email,
      parentFolderId
    );


    console.log('final result ==> ', result)

    res.json(result)
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

// Update multiple cells in the Google Sheet
router.put('/sheets/:fileId/updates/', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    const response = await updateBatchCells(fileId, updates)

    console.log('response ==> ', response.data)

    res.json({
      success: true,
      message: "Data updated successfully"
    })

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
})

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