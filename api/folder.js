import { createFolder, assertAuthorizedForFileIds } from '../server/google-auth.js';
import { getAuthenticatedEmail } from '../server/firebaseAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Must provide a name' });
    }

    const userEmail = await getAuthenticatedEmail(req);

    if (parentId) {
      await assertAuthorizedForFileIds([parentId], userEmail);
    }

    const sharedFolderId = process.env.GOOGLE_PARENT_FOLDER_ID;
    const folderData = await createFolder(name, userEmail, sharedFolderId, parentId);

    res.status(200).json(folderData);
  } catch (error) {
    console.error('Error creating folder:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error?.message?.includes("Request had invalid authentication credentials.")) {
      return res.status(401).json({ error: 'Invalid Token' });
    }
    res.status(500).json({ error: 'Failed to create folder' });
  }
}