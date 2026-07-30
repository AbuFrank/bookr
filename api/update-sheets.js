import { updateSpreadsheet, assertAuthorizedForFileIds } from '../server/google-auth.js';
import { getAuthenticatedEmail } from '../server/firebaseAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    const email = await getAuthenticatedEmail(req);

    await assertAuthorizedForFileIds(updates.map(({ fileId }) => fileId), email);

    // Process all updates
    const responses = await Promise.all(
      updates.map(({ fileId, transactions, ...allUpdates }) =>
        updateSpreadsheet(fileId, transactions, allUpdates)
      )
    );

    const results = responses.map((result, idx) => ({
      index: idx,
      success: result?.status === 200,
      data: result?.data,
    }));

    res.status(200).json(results);
  } catch (error) {
    console.error('Error updating sheets:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
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
}