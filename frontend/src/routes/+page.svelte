<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sendMessage, fetchHistory } from '$lib/api';
  import { chatStore, type ChatMessage } from '$lib/chatStore';

  const SESSION_KEY = 'spur_session_id';
  const MAX_INPUT_LENGTH = 2000;

  let inputValue = '';
  let messagesEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;
  let isLoading = false;
  let errorBanner = '';
  let charCount = 0;

  $: messages = $chatStore.messages;
  $: sessionId = $chatStore.sessionId;
  $: charCount = inputValue.length;
  $: isOverLimit = charCount > MAX_INPUT_LENGTH;
  $: canSend = inputValue.trim().length > 0 && !isLoading && !isOverLimit;

  onMount(async () => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const history = await fetchHistory(savedSession);
        chatStore.loadHistory(history.sessionId, history.messages);
        await scrollToBottom();
      } catch {
        // Session expired or invalid — start fresh
        localStorage.removeItem(SESSION_KEY);
      }
    }
    inputEl?.focus();
  });

  async function scrollToBottom(smooth = false) {
    await tick();
    if (messagesEl) {
      messagesEl.scrollTo({
        top: messagesEl.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
      });
    }
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isLoading || isOverLimit) return;

    errorBanner = '';
    inputValue = '';

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    chatStore.addMessage(userMsg);
    await scrollToBottom(true);

    isLoading = true;
    chatStore.setLoading(true);

    try {
      const result = await sendMessage(text, sessionId ?? undefined);

      // Persist session
      if (!sessionId) {
        chatStore.setSessionId(result.sessionId);
        localStorage.setItem(SESSION_KEY, result.sessionId);
      }

      const aiMsg: ChatMessage = {
        id: result.messageId,
        sender: 'ai',
        text: result.reply,
        timestamp: new Date(),
      };
      chatStore.addMessage(aiMsg);
      await scrollToBottom(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      errorBanner = message;

      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: "Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date(),
        isError: true,
      };
      chatStore.addMessage(errMsg);
      await scrollToBottom(true);
    } finally {
      isLoading = false;
      chatStore.setLoading(false);
      inputEl?.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    localStorage.removeItem(SESSION_KEY);
    chatStore.reset();
    inputValue = '';
    inputEl?.focus();
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const SUGGESTIONS = [
    "What's your return policy?",
    'Do you ship to Canada?',
    'What are your support hours?',
    'How long does shipping take?',
  ];

  async function useSuggestion(s: string) {
    inputValue = s;
    await tick();
    handleSend();
  }
</script>

<div class="layout">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">S</div>
      <span class="logo-text">Spur Store</span>
    </div>
    <div class="sidebar-tagline">AI Support</div>

    <nav class="sidebar-nav">
      <button class="nav-item active" aria-current="page">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Live Chat
      </button>
    </nav>

    <div class="sidebar-footer">
      <button class="new-chat-btn" on:click={handleNewChat}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New conversation
      </button>
      {#if sessionId}
        <div class="session-id">
          <span>Session</span>
          <code>{sessionId.slice(0, 8)}…</code>
        </div>
      {/if}
    </div>
  </aside>

  <!-- Main chat area -->
  <main class="chat-main">
    <header class="chat-header">
      <div class="agent-info">
        <div class="agent-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <div>
          <div class="agent-name">Spur Support</div>
          <div class="agent-status">
            <span class="status-dot"></span>
            Online · AI-powered
          </div>
        </div>
      </div>
    </header>

    <!-- Messages -->
    <div class="messages" bind:this={messagesEl}>
      {#if messages.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h2>How can we help?</h2>
          <p>Ask anything about shipping, returns, or our products.</p>

          <div class="suggestions">
            {#each SUGGESTIONS as suggestion}
              <button class="suggestion-chip" on:click={() => useSuggestion(suggestion)}>
                {suggestion}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="messages-inner">
          {#each messages as msg (msg.id)}
            <div class="message-row {msg.sender}" class:error={msg.isError}>
              {#if msg.sender === 'ai'}
                <div class="bubble-avatar">S</div>
              {/if}
              <div class="bubble-wrap">
                <div class="bubble">
                  <p>{msg.text}</p>
                </div>
                <div class="bubble-meta">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          {/each}

          {#if isLoading}
            <div class="message-row ai">
              <div class="bubble-avatar">S</div>
              <div class="bubble-wrap">
                <div class="bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Error banner -->
    {#if errorBanner}
      <div class="error-banner" role="alert">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {errorBanner}
        <button on:click={() => (errorBanner = '')}>✕</button>
      </div>
    {/if}

    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrap" class:over-limit={isOverLimit}>
        <textarea
          bind:this={inputEl}
          bind:value={inputValue}
          on:keydown={handleKeydown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows="1"
          maxlength={MAX_INPUT_LENGTH + 200}
          disabled={isLoading}
          aria-label="Chat message input"
        ></textarea>

        <div class="input-controls">
          {#if charCount > MAX_INPUT_LENGTH * 0.8}
            <span class="char-count" class:warn={isOverLimit}>
              {charCount}/{MAX_INPUT_LENGTH}
            </span>
          {/if}
          <button
            class="send-btn"
            on:click={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            title="Send (Enter)"
          >
            {#if isLoading}
              <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            {:else}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            {/if}
          </button>
        </div>
      </div>
      <p class="input-hint">Spur AI · Responses may not always be accurate · <a href="mailto:support@spurstore.com">Contact a human</a></p>
    </div>
  </main>
</div>

<style>
  .layout {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 20px 16px;
    gap: 8px;
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0 12px;
  }

  .logo-mark {
    width: 32px;
    height: 32px;
    background: var(--accent);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    color: #fff;
    flex-shrink: 0;
  }

  .logo-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .sidebar-tagline {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 0 4px 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }

  .sidebar-nav {
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .nav-item.active,
  .nav-item:hover {
    background: var(--accent-dim);
    color: var(--accent);
  }

  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .new-chat-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: none;
    border: 1px dashed var(--border);
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .new-chat-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }

  .session-id {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-dim);
    padding: 0 2px;
  }

  .session-id code {
    font-family: var(--font-mono);
    font-size: 10px;
    background: var(--surface-2);
    padding: 2px 5px;
    border-radius: 4px;
    color: var(--text-muted);
  }

  /* ── Chat main ── */
  .chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .chat-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    background: var(--surface);
  }

  .agent-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .agent-avatar {
    width: 38px;
    height: 38px;
    background: var(--accent-dim);
    border: 1.5px solid var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }

  .agent-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .agent-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    background: var(--success);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Messages ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    scroll-behavior: smooth;
  }

  .messages-inner {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 760px;
    margin: 0 auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    text-align: center;
    padding: 40px;
    max-width: 480px;
    margin: 0 auto;
  }

  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-dim);
    border: 1.5px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    margin-bottom: 8px;
  }

  .empty-state h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-muted);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 12px;
  }

  .suggestion-chip {
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .suggestion-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }

  /* ── Message bubbles ── */
  .message-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    animation: fadeUp 0.2s ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .message-row.user {
    flex-direction: row-reverse;
  }

  .bubble-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-bottom: 18px;
  }

  .bubble-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 72%;
  }

  .message-row.user .bubble-wrap {
    align-items: flex-end;
  }

  .bubble {
    padding: 11px 15px;
    border-radius: var(--radius);
    line-height: 1.55;
    font-size: 14.5px;
    word-break: break-word;
  }

  .message-row.user .bubble {
    background: var(--user-bubble);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .message-row.ai .bubble {
    background: var(--ai-bubble);
    color: var(--text);
    border-bottom-left-radius: 4px;
    border: 1px solid var(--border);
  }

  .message-row.error .bubble {
    border-color: var(--error);
    color: var(--error);
  }

  .bubble-meta {
    font-size: 11px;
    color: var(--text-dim);
    padding: 0 4px;
  }

  /* Typing indicator */
  .bubble.typing {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 14px 18px;
    min-width: 56px;
  }

  .bubble.typing span {
    width: 7px;
    height: 7px;
    background: var(--text-dim);
    border-radius: 50%;
    animation: blink 1.2s infinite;
  }

  .bubble.typing span:nth-child(2) { animation-delay: 0.2s; }
  .bubble.typing span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes blink {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.9); }
    40% { opacity: 1; transform: scale(1.1); }
  }

  /* ── Error banner ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 24px 8px;
    padding: 10px 14px;
    background: #ff5f6d18;
    border: 1px solid var(--error);
    border-radius: var(--radius-sm);
    color: var(--error);
    font-size: 13px;
    flex-shrink: 0;
  }

  .error-banner button {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--error);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .error-banner button:hover { opacity: 1; }

  /* ── Input area ── */
  .input-area {
    padding: 16px 24px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg);
  }

  .input-wrap {
    display: flex;
    align-items: flex-end;
    gap: 0;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.15s;
    overflow: hidden;
    max-width: 760px;
    margin: 0 auto;
  }

  .input-wrap:focus-within {
    border-color: var(--accent);
  }

  .input-wrap.over-limit {
    border-color: var(--error);
  }

  textarea {
    flex: 1;
    background: none;
    border: none;
    color: var(--text);
    font: inherit;
    font-size: 14.5px;
    padding: 13px 16px;
    resize: none;
    outline: none;
    min-height: 48px;
    max-height: 160px;
    overflow-y: auto;
    field-sizing: content;
  }

  textarea::placeholder {
    color: var(--text-dim);
  }

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 8px 0;
    flex-shrink: 0;
  }

  .char-count {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .char-count.warn {
    color: var(--error);
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--accent);
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s, transform 0.1s;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .input-hint {
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 8px;
    max-width: 760px;
    margin-left: auto;
    margin-right: auto;
  }

  .input-hint a {
    color: var(--accent);
    text-decoration: none;
  }

  .input-hint a:hover {
    text-decoration: underline;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .sidebar { display: none; }
    .messages { padding: 16px; }
    .input-area { padding: 12px 16px 16px; }
    .chat-header { padding: 12px 16px; }
  }
</style>
