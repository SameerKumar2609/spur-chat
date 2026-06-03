import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.routes';
import { errorHandler } from './middleware/errorHandler';
import { testConnection } from './db/pool';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  })
);

app.use(express.json({ limit: '50kb' }));

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/chat', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/chat', chatRoutes);

// 404 handler (must be after routes)
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await testConnection();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   POST /chat/message`);
    console.log(`   GET  /chat/history/:sessionId`);
    console.log(`   GET  /health`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
