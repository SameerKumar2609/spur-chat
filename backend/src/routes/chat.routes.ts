import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { ChatService } from '../services/chat.service';
import { LLMService } from '../services/llm.service';
import { ConversationRepository } from '../repositories/conversation.repository';

const router = Router();

// Dependency wiring
const conversationRepo = new ConversationRepository();
const llmService = new LLMService();
const chatService = new ChatService(conversationRepo, llmService);
const chatController = new ChatController(chatService);

// POST /chat/message
router.post('/message', chatController.postMessage);

// GET /chat/history/:sessionId
router.get('/history/:sessionId', chatController.getHistory);

export default router;
