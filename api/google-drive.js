// api/google-drive.js
import express from 'express';
const app = express();
app.use(express.json());

// Handle all routes properly with a fallback
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug endpoint working',
    environment: process.env.VERCEL_ENV || 'development'
  });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Root endpoint 
app.get('/', (req, res) => {
  res.json({
    message: 'Google Drive API function',
    endpoints: {
      health: '/health',
      debug: '/debug',
      test: '/test'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;