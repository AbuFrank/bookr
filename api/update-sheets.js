import { updateSpreadsheet } from '../server/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    // Process all updates
    const results = await Promise.all(
      updates.map(({ fileId, transactions, ...allUpdates }) =>
        updateSpreadsheet(fileId, transactions, allUpdates)
      )
    );

    res.status(200).json(results);
  } catch (error) {
    console.error('Error updating sheets:', error);
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