import express from 'express';
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    function: 'clean-test'
  });
});

export default app;