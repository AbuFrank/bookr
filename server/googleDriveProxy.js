import express from 'express';
import { google } from 'googleapis';
const router = express.Router();

// Middleware to authenticate and get Google Drive client
const getGoogleDriveClient = async (req, res, next) => {
  try {
    // Get access token from request headers
    const accessToken = req.headers.authorization?.replace('Bearer ', '') ||
      req.body.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const drive = new google.drive({
      version: 'v3',
      auth: accessToken
    });

    req.drive = drive;
    next();
  } catch (error) {
    console.error('Error creating Google Drive client:', error);
    res.status(500).json({ error: 'Failed to create Google Drive client' });
  }
};

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