import { createFolder } from '../server/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, parentId, userEmail } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Must provide a name' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'Must provide user email' });
    }

    const sharedFolderId = process.env.GOOGLE_PARENT_FOLDER_ID;
    const folderData = await createFolder(name, userEmail, sharedFolderId, parentId);

    res.status(200).json(folderData);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
}