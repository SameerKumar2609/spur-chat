import { ConversationRepository } from '../repositories/conversation.repository';
import { LLMService } from './llm.service';
import { ChatResponse, HistoryResponse, LLMMessage, Message } from '../types';

// Maximum character length for a single user message
const MAX_MESSAGE_LENGTH = 2000;

// How many recent messages to pass as context to the LLM
const CONTEXT_WINDOW = 10;

export class ChatService {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly llmService: LLMService
  ) {}

  /**
   * Handle a new chat message.
   * - Creates a conversation if sessionId is new/missing.
   * - Persists the user message.
   * - Calls the LLM with recent history.
   * - Persists the AI reply.
   * - Returns the reply + sessionId.
   */
  async handleMessage(
    userText: string,
    sessionId?: string
  ): Promise<ChatResponse> {
    // 1. Sanitise / validate message
    const trimmed = userText.trim();
    if (!trimmed) {
      throw new ValidationError('Message cannot be empty');
    }
    const safeText = trimmed.length > MAX_MESSAGE_LENGTH
      ? trimmed.slice(0, MAX_MESSAGE_LENGTH)
      : trimmed;

    // 2. Resolve or create conversation
    let conversationId: string;

    if (sessionId) {
      const existing = await this.conversationRepo.findConversation(sessionId);
      if (existing) {
        conversationId = existing.id;
      } else {
        // Unknown sessionId → start a fresh conversation
        const conv = await this.conversationRepo.createConversation();
        conversationId = conv.id;
      }
    } else {
      const conv = await this.conversationRepo.createConversation();
      conversationId = conv.id;
    }

    // 3. Persist user message
    await this.conversationRepo.saveMessage(conversationId, 'user', safeText);

    // 4. Fetch recent history to build LLM context
    const recentMessages = await this.conversationRepo.getRecentMessages(
      conversationId,
      CONTEXT_WINDOW
    );
    // The last message is the one we just inserted; exclude it from history
    const historyMessages = recentMessages.slice(0, -1);
    const llmHistory = this.toLLMHistory(historyMessages);

    // 5. Call LLM
    const replyText = await this.llmService.generateReply(llmHistory, safeText);

    // 6. Persist AI reply
    const aiMessage = await this.conversationRepo.saveMessage(
      conversationId,
      'ai',
      replyText
    );

    return {
      reply: replyText,
      sessionId: conversationId,
      messageId: aiMessage.id,
    };
  }

  /**
   * Fetch the full message history for a conversation.
   */
  async getHistory(sessionId: string): Promise<HistoryResponse> {
    const conversation = await this.conversationRepo.findConversation(sessionId);
    if (!conversation) {
      throw new NotFoundError(`Conversation not found: ${sessionId}`);
    }
    const messages = await this.conversationRepo.getMessages(sessionId);
    return { sessionId, messages };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toLLMHistory(messages: Message[]): LLMMessage[] {
    return messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
