/**
 * CoachDebugPanel — 直接把学生代码+题目信息发给 AI 分析
 */
import { escapeHtml, renderMarkdown } from '../../shared/core/utils.js';

export default class CoachDebugPanel {
  constructor(container, { aiService, lessonTitle, homeworkTitle, answerCode, commonMistakes, description }) {
    this.container = container;
    this.aiService = aiService;
    this.context = { lessonTitle, homeworkTitle, answerCode, commonMistakes, description };
    this.analyzing = false;
  }

  render() {
    this.container.innerHTML = `
      <div class="debug-panel">
        <div class="debug-header">🔍 代码 Debug — AI 自动分析</div>
        <textarea class="debug-input" placeholder="粘贴学生代码，点击分析，AI 会自动对比参考答案找出错误..." rows="6"></textarea>
        <div class="debug-actions">
          <button class="debug-run-btn">🤖 AI 分析代码</button>
          <button class="debug-diff-btn">👀 对比</button>
        </div>
        <div class="debug-result" style="display:none"></div>
      </div>`;

    this.container.querySelector('.debug-run-btn').addEventListener('click', () => this.analyze());
    this.container.querySelector('.debug-diff-btn').addEventListener('click', () => this.compare());
    this.container.querySelector('.debug-input').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') this.analyze();
    });
  }

  async analyze() {
    if (this.analyzing) return;
    const input = this.container.querySelector('.debug-input');
    const resultDiv = this.container.querySelector('.debug-result');
    const btn = this.container.querySelector('.debug-run-btn');
    const code = input.value.trim();

    if (!code) { resultDiv.style.display = 'block'; resultDiv.innerHTML = '<div class="debug-error">⚠️ 请粘贴学生代码后再分析</div>'; return; }

    this.analyzing = true; btn.disabled = true; btn.textContent = '⏳ AI 分析中...';
    resultDiv.style.display = 'block'; resultDiv.innerHTML = '<div class="debug-loading">🤖 正在将题目和学生代码发送给 AI 分析...</div>';

    const prompt = this.aiService.buildDebugContext(
      this.context.lessonTitle, this.context.homeworkTitle,
      this.context.answerCode || '（无参考答案）', code,
      this.context.commonMistakes, this.context.description
    );

    try {
      const aiResponse = await this.aiService.sendMessage(prompt, 'coach');
      resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">🤖 AI 代码分析</div><div class="debug-result-body">${renderMarkdown(aiResponse)}</div></div>`;
    } catch (e) {
      resultDiv.innerHTML = `<div class="debug-error">⚠️ 分析失败：${escapeHtml(e.message)}。请检查 AI Key 是否已配置。</div>`;
    } finally {
      btn.disabled = false; btn.textContent = '🤖 AI 分析代码'; this.analyzing = false;
    }
  }

  async compare() {
    if (this.analyzing) return;
    const input = this.container.querySelector('.debug-input');
    const resultDiv = this.container.querySelector('.debug-result');
    const btn = this.container.querySelector('.debug-diff-btn');
    const code = input.value.trim();

    if (!code) { resultDiv.style.display = 'block'; resultDiv.innerHTML = '<div class="debug-error">⚠️ 请粘贴学生代码后再对比</div>'; return; }

    this.analyzing = true; btn.disabled = true; btn.textContent = '⏳ 对比中...';
    resultDiv.style.display = 'block'; resultDiv.innerHTML = '<div class="debug-loading">👀 正在逐行对比学生代码和参考答案...</div>';

    const prompt = this.aiService.buildCompareContext(
      this.context.lessonTitle, this.context.homeworkTitle,
      this.context.answerCode || '（无参考答案）', code, this.context.description
    );

    try {
      const aiResponse = await this.aiService.sendMessage(prompt, 'coach');
      resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">👀 代码对比</div><div class="debug-result-body">${renderMarkdown(aiResponse)}</div></div>`;
    } catch (e) {
      resultDiv.innerHTML = `<div class="debug-error">⚠️ 对比失败：${escapeHtml(e.message)}。请检查 AI Key 是否已配置。</div>`;
    } finally {
      btn.disabled = false; btn.textContent = '👀 对比'; this.analyzing = false;
    }
  }
}
