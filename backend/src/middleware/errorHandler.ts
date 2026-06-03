import { Request, Response, NextFunction } from 'express';
import { ValidationError, NotFoundError } from '../services/chat.service';
import Anthropic from '@anthropic-ai/sdk';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error('[Error]', err);

  // Domain errors
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  // Anthropic API errors
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 502;

    if (status === 401) {
      res.status(502).json({
        error: 'AI service authentication failed. Please check your API key.',
      });
      return;
    }

    if (status === 429) {
      res.status(503).json({
        error: 'AI service is busy right now. Please try again in a moment.',
      });
      return;
    }

    if (status >= 500) {
      res.status(502).json({
        error: 'AI service is temporarily unavailable. Please try again shortly.',
      });
      return;
    }
  }

  // Timeout errors
  if (err instanceof Error && err.message?.includes('timeout')) {
    res.status(504).json({
      error: 'The AI took too long to respond. Please try again.',
    });
    return;
  }

  // Generic fallback
  res.status(500).json({
    error: 'Something went wrong. Please try again or contact support@spurstore.com.',
  });
}
