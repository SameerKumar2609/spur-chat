import Groq from 'groq-sdk';
import { LLMMessage } from '../types';

const STORE_KNOWLEDGE = `
You are a helpful, friendly support agent for "Spur Store" — a small e-commerce store, also you know about Data structures and algorithms.

## Store Information
- Name: Spur Store
- Website: spurstore.com
- Email: support@spurstore.com

## Shipping Policy
- We ship to the US, Canada, UK, and Australia.
- Standard shipping: 5–7 business days (free on orders over $50).
- Express shipping: 2–3 business days ($12.99).
- Orders are processed within 1 business day of purchase.

## Return & Refund Policy
- 30-day return window from date of delivery.
- Items must be unused, in original packaging.
- Contact support@spurstore.com with your order number to start a return.
- Refunds processed within 3–5 business days of receiving the return.
- Sale items are final sale.

## Support Hours
- Live human support: Monday–Friday, 9 AM–6 PM EST.
- AI support: 24/7.

## Payment
- We accept Visa, Mastercard, Amex, PayPal, and Apple Pay.

## Instructions
- Be concise, friendly, and helpful.
- If you don't know the answer, direct the user to support@spurstore.com.
- Keep responses to 2–4 sentences unless more detail is needed.
`.trim();

const MAX_HISTORY_MESSAGES = 10;

export class LLMService {
  private client: Groq;
  private model = 'llama-3.3-70b-versatile';

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    this.client = new Groq({ apiKey });
  }

  async generateReply(history: LLMMessage[], userMessage: string): Promise<string> {
    const messages = [
      ...history.slice(-MAX_HISTORY_MESSAGES),
      { role: 'user' as const, content: userMessage },
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 512,
      messages: [
        { role: 'system', content: STORE_KNOWLEDGE },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a response.';
  }
}