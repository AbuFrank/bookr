import express from 'express';
import { copySheetToTemplate, copyTemplateFile, createFolder, updateSpreadsheet } from './google-auth.js';
import path from 'path';

const router = express.Router();

// Load environment variables
import dotenv from 'dotenv';
// Load environment variables - works locally and in Vercel
console.log('NODE env? ', process.env.NODE_ENV)
if (!process.env.NODE_ENV) {
  // Load local .env only in development
  dotenv.config({ path: path.join(process.cwd(), 'server/.env.local') });
}

const templateId = process.env.GOOGLE_TEMPLATE_ID
const sourceTemplateId = process.env.GOOGLE_SOURCE_ID
const sharedFolderId = process.env.GOOGLE_PARENT_FOLDER_ID

// TODO remove /auth/google route in lieu of shared drive file storage
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

// Create folder for the user
router.post('/folder', async (req, res) => {
  try {
    const { name, parentId, userEmail } = req.body;

    console.log('creating folder ...', { name, parentId, userEmail, sharedFolderId })

    if (!name) {
      return res.status(400).json({ error: 'Must provide a name' });
    }


    if (!userEmail) {
      return res.status(400).json({ error: 'Must provide user email' });
    }

    const folderData = await createFolder(name, userEmail, sharedFolderId, parentId)
    console.log('successful folder data ==> ', folderData)
    res.json(folderData);
  } catch (error) {
    console.error('Error creating folder:', error?.response || error);
    if (error?.message?.includes("Request had invalid authentication credentials.")) {
      return res.status(401).json({ error: 'Invalid Token' })
    }
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Copy file from template to user's drive
router.post('/copy-template', async (req, res) => {
  try {
    const { fileName, email, parentFolderId, description } = req.body;

    console.log("API... ")
    console.log("templateId ==> ", templateId)
    console.log("fileName ==> ", fileName)
    console.log("email ==> ", email)
    console.log("parent folder id ===> ", parentFolderId)

    if (!templateId) {
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
      templateId,
      fileName,
      email,
      parentFolderId,
      description
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
      return res.status(401).json({ error: 'Invalid Token' })
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

// Copy a specific sheet from one template to another DO NOT DELETE
router.get('/copy-template-sheet', async (req, res) => {
  try {

    console.log("copy-sheet-tab API... ")
    console.log("templateId ==> ", templateId)
    console.log('source template id ==> ', sourceTemplateId)

    if (!templateId) {
      return res.status(400).json({ error: 'No template file found.' });
    }

    if (!sourceTemplateId) {
      return res.status(400).json({ error: 'No source template file found.' });
    }


    const result = await copySheetToTemplate(
      templateId,
      sourceTemplateId
    );

    console.log('copy template result ==> ', result)


    res.json({ message: "copy success" })
  } catch (error) {
    console.error('Error copying file:', error);
    if (error.code === 400) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    if (error?.message?.includes("Request had invalid authentication credentials.")) {
      return res.status(401).json({ error: 'Invalid Token' })
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
router.put('/update-sheets', async (req, res) => {
  try {

    console.log('...googleDriveRoutes')
    console.log('/update-sheets')
    // const { fileId } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    // update each corresponding spreadsheet file provided by the update data
    const responses = await Promise.all(
      updates.map(({ fileId, transactions, ...allUpdates }) => updateSpreadsheet(fileId, transactions, allUpdates))
    )

    const results = responses.map((result, idx) => ({
      index: idx,
      success: result?.status === 200,
      data: result?.data,
    }))
    console.log('response ==> ', results)

    res.json(results)

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
    res.status(500).json({ error: 'Failed to update sheets' });
  }
})

// Update a cell in Google Sheet
// router.put('/api/sheets/:fileId/values/:range', getGoogleDriveClient, async (req, res) => {
//   try {
//     const { fileId, range } = req.params;
//     const { values } = req.body;

//     if (!values || !Array.isArray(values)) {
//       return res.status(400).json({ error: 'Invalid values format' });
//     }

//     const response = await req.drive.spreadsheets.values.update({
//       spreadsheetId: fileId,
//       range: range,
//       valueInputOption: 'USER_ENTERED',
//       requestBody: { values }
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error updating sheet:', error);
//     // Handle specific Google API errors
//     if (error.code === 400) {
//       return res.status(400).json({ error: 'Invalid request parameters' });
//     }
//     if (error.code === 403) {
//       return res.status(403).json({ error: 'Access denied' });
//     }
//     if (error.code === 404) {
//       return res.status(404).json({ error: 'File not found' });
//     }
//     res.status(500).json({ error: 'Failed to update sheet' });
//   }
// });

// Get file metadata
// router.get('/api/files/:fileId', getGoogleDriveClient, async (req, res) => {
//   try {
//     const { fileId } = req.params;

//     const response = await req.drive.files.get({
//       fileId,
//       fields: 'id,name,mimeType,modifiedTime'
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error getting file:', error);
//     if (error.code === 404) {
//       return res.status(404).json({ error: 'File not found' });
//     }
//     res.status(500).json({ error: 'Failed to get file' });
//   }
// });

// List files
// router.get('/api/files', getGoogleDriveClient, async (req, res) => {
//   try {
//     const response = await req.drive.files.list({
//       pageSize: 10,
//       fields: 'files(id,name,mimeType,modifiedTime)'
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error listing files:', error);
//     res.status(500).json({ error: 'Failed to list files' });
//   }
// });

// Get spreadsheet metadata
// router.get('/sheets/:fileId', getGoogleDriveClient, async (req, res) => {
//   try {
//     const { fileId } = req.params;

//     const response = await req.drive.spreadsheets.get({
//       spreadsheetId: fileId,
//       fields: 'properties,sheets'
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error getting spreadsheet:', error);
//     res.status(500).json({ error: 'Failed to get spreadsheet' });
//   }
// });

export default router;


// Backup
// Create folder for the user
// router.post('/folder', getGoogleDriveClient, async (req, res) => {
//   try {
//     const { name, parentId } = req.body;

//     if (!name) {
//       return res.status(400).json({ error: 'Must provide a name' });
//     }

//     const response = await req.drive.files.create({
//       requestBody: {
//         name: name,
//         mimeType: 'application/vnd.google-apps.folder',
//         parents: parentId ? [parentId] : []
//       },
//       fields: 'id, name, webViewLink',
//     });

//     console.log('attempting folder permissions for bookr manager...', response.data.id)
//     const newFolderId = response.data.id

//     console.log('email address ==> ', serviceEmail)

//     await req.drive.permissions.create({
//       fileId: newFolderId,
//       requestBody: {
//         role: 'writer',
//         type: 'user',
//         emailAddress: serviceEmail
//       },
//       supportsAllDrives: true
//     });

//     res.json(response.data);
//   } catch (error) {
//     if (error?.message?.includes("Request had invalid authentication credentials.")) {
//       res.status(401).json({ error: 'Invalid Token' })
//     }
//     console.error('Error creating folder:', error);
//     res.status(500).json({ error: 'Failed to create folder' });
//   }
// });