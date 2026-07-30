import { copyTemplateFile, assertAuthorizedForFileIds } from '../server/google-auth.js';
import { getAuthenticatedEmail } from '../server/firebaseAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, parentFolderId, description } = req.body;

    const templateId = process.env.GOOGLE_TEMPLATE_ID

    if (!templateId) {
      return res.status(400).json({ error: 'Template file not configured' });
    }

    if (!parentFolderId) {
      return res.status(400).json({ error: 'Must provide parent folder ID' });
    }

    const email = await getAuthenticatedEmail(req);

    await assertAuthorizedForFileIds([parentFolderId], email);

    const sharedFolderId = process.env.GOOGLE_PARENT_FOLDER_ID;
    const result = await copyTemplateFile(
      templateId,
      fileName,
      email,
      parentFolderId,
      description
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error copying file:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.code === 400) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    if (error?.message?.includes("Request had invalid authentication credentials.")) {
      return res.status(401).json({ error: 'Invalid Token' });
    }
    if (error.code === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (error.code === 404) {
      return res.status(404).json({ error: 'Source file not found' });
    }
    res.status(500).json({ error: 'Failed to copy file' });
  }
}