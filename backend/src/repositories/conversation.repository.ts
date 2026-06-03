import { query } from '../db/pool';
import { Conversation, Message, Sender } from '../types';

export class ConversationRepository {
  /**
   * Create a new conversation and return it.
   */
  async createConversation(metadata: Record<string, unknown> = {}): Promise<Conversation> {
    const rows = await query<Conversation>(
      `INSERT INTO conversations (metadata)
       VALUES ($1)
       RETURNING *`,
      [JSON.stringify(metadata)]
    );
    return rows[0];
  }

  /**
   * Find a conversation by ID. Returns null if not found.
   */
  async findConversation(id: string): Promise<Conversation | null> {
    const rows = await query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Persist a message and return the saved record.
   */
  async saveMessage(
    conversationId: string,
    sender: Sender,
    text: string
  ): Promise<Message> {
    const rows = await query<Message>(
      `INSERT INTO messages (conversation_id, sender, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversationId, sender, text]
    );
    return rows[0];
  }

  /**
   * Get all messages for a conversation, ordered oldest-first.
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    return query<Message>(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
  }

  /**
   * Get the last N messages for a conversation (for LLM context window).
   */
  async getRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    const rows = await query<Message>(
      `SELECT * FROM (
         SELECT * FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) sub
       ORDER BY created_at ASC`,
      [conversationId, limit]
    );
    return rows;
  }
}
