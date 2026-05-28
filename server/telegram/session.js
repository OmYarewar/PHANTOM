import { createConversation, getMessages } from '../memory/store.js';

let currentSession = {
  conversationId: null,
  status: 'idle', // 'idle', 'running', 'stopped'
  abortController: null
};

export function startSession() {
  if (!currentSession.conversationId) {
    const conv = createConversation('Telegram Session');
    currentSession.conversationId = conv.id;
  }
  currentSession.status = 'running';
  currentSession.abortController = new AbortController();
  return currentSession;
}

export function stopSession() {
  if (currentSession.abortController) {
    currentSession.abortController.abort();
    currentSession.abortController = null;
  }
  currentSession.status = 'stopped';
  return currentSession;
}

export function getSession() {
  return currentSession;
}

export function resetSession() {
    currentSession.conversationId = null;
    currentSession.status = 'idle';
    if(currentSession.abortController) {
        currentSession.abortController.abort();
        currentSession.abortController = null;
    }
}

export function getHistory() {
  if (!currentSession.conversationId) return [];
  return getMessages(currentSession.conversationId);
}
