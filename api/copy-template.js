import { copyTemplateFile } from '../server/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, email, parentFolderId, description } = req.body;

    const templateId = process.env.GOOGLE_TEMPLATE_ID

    if (!templateId) {
      return res.status(400).json({ error: 'Template file not configured' });
    }

    if (!parentFolderId) {
      return res.status(400).json({ error: 'Must provide parent folder ID' });
    }

    if (!email) {
      return res.status(400).json({ error: 'User email required' });
    }

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
}