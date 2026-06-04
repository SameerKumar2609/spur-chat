const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: string;
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

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function fetchHistory(sessionId: string): Promise<HistoryResponse> {
  const res = await fetch(`${BASE}/chat/history/${sessionId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error: ${res.status}`);
  }

  return res.json();
}