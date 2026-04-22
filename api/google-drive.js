// api/google-drive.js
import express from 'express';
const app = express();
app.use(express.json());

console.log('Google Drive function initialized!');

app.get('/health', (req, res) => {
  console.log('Health endpoint hit!');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/debug', (req, res) => {
  console.log('Debug endpoint hit!');
  res.json({
    message: 'Debug working',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV
  });
});

app.get('/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ message: 'Google Drive function is working!' });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint hit!');
  res.json({
    message: 'Google Drive API is ready',
    timestamp: new Date().toISOString()
  });
});

export default app;