import express from 'express';
const app = express();

app.get('/', (req, res) => {
  console.log('Vercel function is working!');
  res.json({
    status: 'success',
    message: 'Vercel function deployed correctly',
    timestamp: new Date().toISOString()
  });
});

export default app;