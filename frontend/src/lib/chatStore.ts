import { writable } from 'svelte/store';
import type { Message } from './api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

function createChatStore() {
  const { subscribe, update, set } = writable<{
    messages: ChatMessage[];
    sessionId: string | null;
    isLoading: boolean;
  }>({
    messages: [],
    sessionId: null,
    isLoading: false,
  });

  return {
    subscribe,

    addMessage(msg: ChatMessage) {
      update((s) => ({ ...s, messages: [...s.messages, msg] }));
    },

    setLoading(loading: boolean) {
      update((s) => ({ ...s, isLoading: loading }));
    },

    setSessionId(id: string) {
      update((s) => ({ ...s, sessionId: id }));
    },

    loadHistory(sessionId: string, messages: Message[]) {
      const chatMessages: ChatMessage[] = messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: new Date(m.created_at),
      }));
      set({ messages: chatMessages, sessionId, isLoading: false });
    },

    reset() {
      set({ messages: [], sessionId: null, isLoading: false });
    },
  };
}

export const chatStore = createChatStore();
