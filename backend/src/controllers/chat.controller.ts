import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatService, ValidationError, NotFoundError } from '../services/chat.service';

// ─── Validation schemas ────────────────────────────────────────────────────

const ChatMessageSchema = z.object({
  message: z
    .string({ required_error: 'message is required' })
    .min(1, 'message cannot be empty')
    .max(2000, 'message is too long (max 2000 characters)'),
  sessionId: z.string().uuid('sessionId must be a valid UUID').optional(),
});

const HistoryParamsSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

// ─── Controller ───────────────────────────────────────────────────────────

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  postMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const parsed = ChatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { message, sessionId } = parsed.data;

    try {
      const result = await this.chatService.handleMessage(message, sessionId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const parsed = HistoryParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid sessionId',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const result = await this.chatService.getHistory(parsed.data.sessionId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
