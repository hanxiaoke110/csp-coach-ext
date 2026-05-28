import { generateId } from '../core/utils.js';
import Storage from '../core/storage.js';
import { STORAGE_KEYS } from '../core/config.js';

export default class SessionService {
  constructor() {
    this.currentSession = null;
  }

  async init() {
    await this.loadCurrentSession();
  }

  async createSession(mode) {
    const sessionId = generateId('sess');
    this.currentSession = {
      sessionId,
      mode,
      createdAt: new Date().toISOString(),
      messages: []
    };
    await this.saveCurrentSession();
    return this.currentSession;
  }

  async loadCurrentSession() {
    try {
      const lastSessionId = await Storage.get(STORAGE_KEYS.SESSION);
      if (lastSessionId) {
        const sessions = await Storage.get(STORAGE_KEYS.SESSIONS) || {};
        if (sessions[lastSessionId]) {
          this.currentSession = sessions[lastSessionId];
          return this.currentSession;
        }
      }
    } catch (error) {
      console.error('[SessionService] Load error:', error);
    }
    return await this.createSession('student');
  }

  async saveCurrentSession() {
    if (!this.currentSession) return;
    try {
      const sessions = await Storage.get(STORAGE_KEYS.SESSIONS) || {};
      sessions[this.currentSession.sessionId] = this.currentSession;
      await Storage.set(STORAGE_KEYS.SESSIONS, sessions);
      await Storage.set(STORAGE_KEYS.SESSION, this.currentSession.sessionId);
    } catch (error) {
      console.error('[SessionService] Save error:', error);
    }
  }

  addMessage(messageData) {
    if (!this.currentSession) return null;
    const message = {
      messageId: generateId('msg'),
      role: messageData.role || 'user',
      content: messageData.content || '',
      type: messageData.type || 'text',
      timestamp: new Date().toISOString(),
      ...messageData
    };
    this.currentSession.messages.push(message);
    return message;
  }

  getCurrentSession() {
    return this.currentSession;
  }
}
