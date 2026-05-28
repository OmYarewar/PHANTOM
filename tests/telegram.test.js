import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBot, stopBot, getBotStatus } from '../server/telegram/bot.js';
import { getSession, resetSession } from '../server/telegram/session.js';

// Mock node-telegram-bot-api
const mockSendMessage = vi.fn().mockResolvedValue(true);
const mockStopPolling = vi.fn();
const mockIsPolling = vi.fn().mockReturnValue(true);

let mockMessageHandler = null;

vi.mock('node-telegram-bot-api', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        sendMessage: mockSendMessage,
        stopPolling: mockStopPolling,
        isPolling: mockIsPolling,
        on: (event, handler) => {
          if (event === 'message') {
            mockMessageHandler = handler;
          }
        }
      };
    })
  };
});

// Mock LLM processMessage
vi.mock('../server/ai/llm-client.js', () => ({
  processMessage: vi.fn().mockImplementation((convId, text, onChunk) => {
      onChunk('AI Response');
      return Promise.resolve('AI Response');
  })
}));

describe('Telegram Bot Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessageHandler = null;
    resetSession();
    stopBot();
  });

  afterEach(() => {
      stopBot();
  });

  it('should not start if token or user id is missing', () => {
    startBot({ token: '', userId: '' });
    expect(getBotStatus().enabled).toBe(false);
    expect(getBotStatus().running).toBe(false);
  });

  it('should start polling with valid config', () => {
    startBot({ token: 'test_token', userId: 12345 });
    expect(getBotStatus().enabled).toBe(true);
    expect(getBotStatus().running).toBe(true);
    expect(getBotStatus().userId).toBe(12345);
  });

  it('should silently ignore messages from non-allowed users', async () => {
    startBot({ token: 'test_token', userId: 12345 });

    expect(mockMessageHandler).toBeDefined();

    await mockMessageHandler({
        chat: { id: 99999 }, // Different user
        text: '/status'
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should respond to allowed user for /status command', async () => {
    startBot({ token: 'test_token', userId: 12345 });

    await mockMessageHandler({
        chat: { id: 12345 },
        text: '/status'
    });

    expect(mockSendMessage).toHaveBeenCalled();
    expect(mockSendMessage.mock.calls[0][1]).toContain('Server Status');
  });

  it('should handle /stop command and update session status', async () => {
      startBot({ token: 'test_token', userId: 12345 });

      // First force a session to be running
      const { startSession } = await import('../server/telegram/session.js');
      startSession();
      expect(getSession().status).toBe('running');

      await mockMessageHandler({
          chat: { id: 12345 },
          text: '/stop'
      });

      expect(mockSendMessage).toHaveBeenCalledWith(12345, expect.stringContaining('Task stopped.'));
      expect(getSession().status).toBe('stopped');
  });

  it('should start a session and call processMessage for normal messages', async () => {
      startBot({ token: 'test_token', userId: 12345 });

      await mockMessageHandler({
          chat: { id: 12345 },
          text: 'Hello world'
      });

      expect(mockSendMessage).toHaveBeenCalledWith(12345, expect.stringContaining('Processing...'));
      // It should also send the response back
      expect(mockSendMessage).toHaveBeenCalledWith(12345, expect.stringContaining('AI Response'));
      expect(getSession().status).toBe('idle'); // Should reset to idle after completion
  });
});
