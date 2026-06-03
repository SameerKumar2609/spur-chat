export type Sender = 'user' | 'ai';

export interface Conversation {
  id: string;
  created_at: Date;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: Sender;
  text: string;
  created_at: Date;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  messageId: string;
}

export interface HistoryResponse {
  sessionId: string;
  messages: Message[];
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}
