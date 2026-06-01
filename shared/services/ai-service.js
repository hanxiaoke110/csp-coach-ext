import Storage from '../core/storage.js';
import { STORAGE_KEYS, COACH_PROMPT, STUDENT_PROMPT, AI_COACH_PROMPT, COACH_DEBUG_PROMPT, APP_MODES, AI_MODELS, API_ENDPOINTS, DEFAULT_CONFIG } from '../core/config.js';
import AIProvider from './ai-provider.js';

export default class AIService {
  constructor(sessionService) {
    this.provider = null;
    this.config = { ...DEFAULT_CONFIG };
    this.sessionService = sessionService;
  }

  async init() {
    try {
      const saved = await Storage.get(STORAGE_KEYS.CONFIG);
      if (saved) this.config = { ...DEFAULT_CONFIG, ...saved };
      this.createProvider();
    } catch (e) {
      console.error('[AIService] Init error:', e);
    }
  }

  createProvider() {
    const { aiProvider, apiKey, model } = this.config;
    if (!apiKey) { this.provider = null; return; }
    const providerModels = AI_MODELS[aiProvider];
    const modelId = model && providerModels[model] ? model : Object.keys(providerModels)[0];
    this.provider = new AIProvider({
      apiKey,
      model: modelId,
      endpoint: API_ENDPOINTS[aiProvider]
    });
  }

  isConfigured() {
    return this.provider !== null && !!this.config.apiKey;
  }

  async ensureConfigured() {
    // 每次调用前重新读配置，支持用户在设置页保存后即时生效
    try {
      const saved = await Storage.get(STORAGE_KEYS.CONFIG);
      if (saved && saved.apiKey) {
        this.config = { ...DEFAULT_CONFIG, ...saved };
        this.createProvider();
      }
    } catch (e) {}
    if (!this.isConfigured()) throw new Error('请先在设置中配置 API Key');
  }

  _buildSystemPrompt(mode) {
    if (mode === APP_MODES.COACH) return COACH_PROMPT;
    if (mode === APP_MODES.COACH_DEBUG) return COACH_DEBUG_PROMPT;
    if (mode === APP_MODES.AI_COACH) return AI_COACH_PROMPT;
    return STUDENT_PROMPT;
  }

  _buildMessages(content, mode) {
    const messages = [{ role: 'system', content: this._buildSystemPrompt(mode) }];

    // Coach / CoachDebug 不附加历史消息，每次独立分析
    if (mode !== APP_MODES.COACH && mode !== APP_MODES.COACH_DEBUG) {
      if (this.sessionService) {
        const session = this.sessionService.getCurrentSession();
        if (session && session.messages) {
          const history = session.messages
            .filter(m => m.content && m.content.trim())
            .slice(-20)
            .map(m => ({ role: m.role, content: m.content }));
          messages.push(...history);
        }
      }
    }

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || last.content !== content) {
      messages.push({ role: 'user', content });
    }

    return messages;
  }

  async sendMessage(content, mode) {
    await this.ensureConfigured();
    const messages = this._buildMessages(content, mode);
    const response = await this.provider.chat(messages);
    // Save to session history
    if (this.sessionService) {
      this.sessionService.addMessage({ role: 'user', content });
      this.sessionService.addMessage({ role: 'assistant', content: response });
      await this.sessionService.saveCurrentSession();
    }
    return response;
  }

  async streamMessage(content, mode, onChunk) {
    await this.ensureConfigured();
    const messages = this._buildMessages(content, mode);
    let fullContent = '';
    await this.provider.stream(messages, (chunk) => {
      fullContent += chunk;
      if (onChunk) onChunk(chunk, fullContent);
    });
    return fullContent;
  }

  _stripBoilerplate(code) {
    if (!code) return '';
    return code
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Remove #include lines
        if (trimmed.startsWith('#include')) return false;
        // Remove using namespace
        if (trimmed === 'using namespace std;') return false;
        // Remove pure comment lines (keep inline comments)
        if (trimmed.startsWith('//') && !trimmed.includes('http')) return false;
        return true;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')  // Collapse 3+ blank lines to 2
      .trim();
  }

  buildDebugContext(lessonTitle, problemTitle, answerCode, studentCode, commonMistakes = [], description = '') {
    const strippedAnswer = this._stripBoilerplate(answerCode);
    const strippedStudent = this._stripBoilerplate(studentCode);
    let tips = '';
    if (commonMistakes?.length) {
      tips = '\n常见错误参考：\n' + commonMistakes.map(m => `- ${m.mistake} → ${m.fix}`).join('\n');
    }
    const descBlock = description ? `\n### 题目描述：\n${description}\n` : '';
    return `## 课程：${lessonTitle}
## 题目：${problemTitle}${descBlock}
### 参考答案：
\`\`\`cpp
${strippedAnswer}
\`\`\`

### 学生代码：
\`\`\`cpp
${strippedStudent}
\`\`\`
${tips}
请按优先级检查：1.输出格式（分隔符/换行/空格）2.算法逻辑 3.语法。数组开大不算错，不报。`;
  }

  buildCompareContext(lessonTitle, problemTitle, answerCode, studentCode, description = '') {
    const strippedAnswer = this._stripBoilerplate(answerCode);
    const strippedStudent = this._stripBoilerplate(studentCode);
    const descBlock = description ? `\n### 题目描述：\n${description}\n` : '';
    return `## 课程：${lessonTitle}
## 题目：${problemTitle}${descBlock}
### 参考答案：
\`\`\`cpp
${strippedAnswer}
\`\`\`

### 学生代码：
\`\`\`cpp
${strippedStudent}
\`\`\`

逐行对比学生代码和参考答案，用以下标注：
+ 多余行（学生写了但答案没有的）
- 缺失行（答案有但学生没写的）
~ 修改行（逻辑不同或写法不同，写清差异）

输出为代码块，每行前面加标注符号。不要给修复建议，只标注差异。200字以内。`;
  }
}
