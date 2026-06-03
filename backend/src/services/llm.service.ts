import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage } from '../types';

// ─── FAQ / Domain knowledge ────────────────────────────────────────────────
// Hardcoded for simplicity. In a production system, this could live in the DB
// and be fetched dynamically (e.g. per-merchant configuration).
const STORE_KNOWLEDGE = `
You are a helpful, friendly support agent for "Spur Store" — a small e-commerce store.

## Store Information
- Name: Spur Store
- Website: spurstore.com
- Email: support@spurstore.com

## Shipping Policy
- We ship to the US, Canada, UK, and Australia.
- Standard shipping: 5–7 business days (free on orders over $50).
- Express shipping: 2–3 business days ($12.99).
- International orders may be subject to customs duties (buyer's responsibility).
- Orders are processed within 1 business day of purchase.

## Return & Refund Policy
- 30-day return window from date of delivery.
- Items must be unused, in original packaging.
- To initiate a return, contact support@spurstore.com with your order number.
- We provide a prepaid return label within 1 business day.
- Refunds are processed within 3–5 business days of receiving the return.
- Sale items are final sale and cannot be returned.

## Support Hours
- Live human support: Monday–Friday, 9 AM–6 PM EST.
- AI support (that's you!): 24/7.
- Response time for email: within 24 hours on business days.

## Products
- We sell a range of lifestyle and home goods.
- All products come with a 1-year manufacturer warranty.
- Product availability varies; check the website for current stock.

## Payment
- We accept Visa, Mastercard, Amex, PayPal, and Apple Pay.
- All transactions are secured with SSL encryption.

## Instructions for the Agent
- Be concise, friendly, and helpful.
- If you don't know the answer, say so honestly and direct the user to support@spurstore.com.
- Never make up order details or invent information not listed above.
- Keep responses to 2–4 sentences unless a detailed explanation is needed.
`.trim();

// Max history turns to include in each LLM request (cost control)
const MAX_HISTORY_MESSAGES = 10;

export class LLMService {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Generate a reply from the LLM given conversation history and a new user message.
   *
   * @param history - Prior messages (already trimmed to MAX_HISTORY_MESSAGES)
   * @param userMessage - The latest user message
   * @returns The AI reply text
   */
  async generateReply(history: LLMMessage[], userMessage: string): Promise<string> {
    // Build messages: history + the new user turn
    const messages: LLMMessage[] = [
      ...history.slice(-MAX_HISTORY_MESSAGES),
      { role: 'user', content: userMessage },
    ];

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: STORE_KNOWLEDGE,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected response type from LLM');
    }

    return block.text.trim();
  }
}
