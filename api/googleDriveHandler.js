import express from 'express';
import { copyTemplateFile, createFolder, getServiceAccountDrive, updateSpreadsheet } from '../server/googleAuth.js';

console.log('=== INITIALIZING SERVERLESS FUNCTION ===');

const app = express();
app.use(express.json());

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV
  });
});

// Debug endpoint
app.get('/debug', async (req, res) => {
  try {
    console.log('Debug endpoint called');
    console.log('Environment variables:', {
      HAS_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64,
      HAS_TEMPLATE_ID: !!process.env.GOOGLE_TEMPLATE_ID,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    });

    // Test service account access
    const drive = getServiceAccountDrive();
    console.log('Service account client created successfully');

    res.json({
      status: 'success',
      message: 'Debug endpoint working',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Create folder for the user
app.post('/folder', async (req, res) => {
  try {
    const { name, parentId, userEmail } = req.body;

    console.log('creating folder ...', { name, parentId, userEmail })

    if (!name) {
      return res.status(400).json({ error: 'Must provide a name' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'Must provide user email' });
    }

    // Add explicit environment check here
    console.log('Environment check:', {
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      IS_PRODUCTION: process.env.VERCEL_ENV === 'production'
    });

    const folderData = await createFolder(name, userEmail, process.env.GOOGLE_PARENT_FOLDER_ID, parentId)
    console.log('successful folder data ==> ', folderData)
    res.json(folderData);
  } catch (error) {
    console.error('Error creating folder:', error);
    if (error?.message?.includes("Request had invalid authentication credentials.")) {
      res.status(401).json({ error: 'Invalid Token' })
    }
    console.error('Error creating folder:', error?.response || error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Copy file from template to user's drive
app.post('/files/copy', async (req, res) => {
  try {
    const { fileName, email, parentFolderId } = req.body;

    console.log("API... ")
    console.log("templateId ==> ", process.env.GOOGLE_TEMPLATE_ID)
    console.log("fileName ==> ", fileName)
    console.log("email ==> ", email)
    console.log("parent folder id ===> ", parentFolderId)

    if (!process.env.GOOGLE_TEMPLATE_ID) {
      return res.status(400).json({ error: 'No template file found.' });
    }

    if (!parentFolderId) {
      return res.status(400).json({ error: 'Must provide a parent folder id.' });
    }

    if (!email) {
      return res.status(400).json({
        error: 'user email is required'
      });
    }

    const result = await copyTemplateFile(
      process.env.GOOGLE_TEMPLATE_ID,
      fileName,
      email,
      process.env.GOOGLE_PARENT_FOLDER_ID,
      parentFolderId
    );

    console.log('copy template result ==> ', result)
    const newFileId = result.fileId

    res.json(result)
  } catch (error) {
    console.error('Error copying file:', error);
    if (error.code === 400) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    if (error?.message?.includes("Request had invalid authentication credentials.")) {
      res.status(401).json({ error: 'Invalid Token' })
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
app.put('/sheets/updates/', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    // update each corresponding spreadsheet file provided by the update data
    Promise.all(updates.map(({ fileId, ...allUpdates }) => updateSpreadsheet(fileId, allUpdates)))
      .then(responses => {
        const results = responses.map((result, idx) => ({
          index: idx,
          success: result.status === 200 ? true : false,
          data: result.data
        }))
        console.log('response ==> ', results)
        res.json(results)
      })
      .catch(error => {
        console.error('Error in batch updates:', error);
        res.status(500).json({ error: 'Failed to update sheets' });
      });

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

export default app;