import { Request, Response, NextFunction } from 'express';
import { ValidationError, NotFoundError } from '../services/chat.service';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  // Groq / fetch errors
  if (err instanceof Error) {
    if (err.message?.includes('401') || err.message?.includes('invalid_api_key')) {
      res.status(502).json({ error: 'AI service authentication failed. Please check your API key.' });
      return;
    }
    if (err.message?.includes('429') || err.message?.includes('rate_limit')) {
      res.status(503).json({ error: 'AI service is busy right now. Please try again in a moment.' });
      return;
    }
    if (err.message?.includes('timeout')) {
      res.status(504).json({ error: 'The AI took too long to respond. Please try again.' });
      return;
    }
  }

  res.status(500).json({
    error: 'Something went wrong. Please try again or contact support@spurstore.com.',
  });
}