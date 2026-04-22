import express from 'express';
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Google Drive function is working!' });
});

export default app;