// server/index.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
import googleDriveRoutes from './googleDriveProxy.js';

// Routes - make sure you're not accidentally adding invalid routes
app.use('/api', googleDriveRoutes);

// Serve static files from build directory (for production)
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback for SPA routing - this is the problematic part in your error
app.get(/^\/(?!api).*$/, (req, res) => {
  // This regex ensures we don't match /api routes and serve index.html for SPA
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;