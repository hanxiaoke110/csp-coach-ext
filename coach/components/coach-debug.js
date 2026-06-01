/**
 * CoachDebugPanel — 直接把学生代码+题目信息发给 AI 分析
 */
import { escapeHtml } from '../../shared/core/utils.js';

function renderResult(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('✅')) return `<div class="debug-correct">${escapeHtml(trimmed)}</div>`;

  // Parse 3-part format: 错哪了 / 错的代码 / 怎么改
  const parts = { what: '', bad: '', fix: '' };
  const lines = trimmed.split('\n');
  let current = '';
  for (const line of lines) {
    if (line.startsWith('错哪了：') || line.startsWith('错哪了:')) { current = 'what'; parts.what = line.replace(/^错哪了[：:]/, '').trim(); }
    else if (line.startsWith('错的代码：') || line.startsWith('错的代码:')) { current = 'bad'; }
    else if (line.startsWith('怎么改：') || line.startsWith('怎么改:')) { current = 'fix'; }
    else if (line.trim()) {
      if (current === 'bad') parts.bad += line + '\n';
      else if (current === 'fix') parts.fix += line + '\n';
    }
  }

  return `
    <div class="debug-finding">
      <div class="debug-label">错哪了</div>
      <div class="debug-what">${escapeHtml(parts.what)}</div>
      ${parts.bad ? `<div class="debug-label bad">错的代码</div>
      <pre class="debug-code-block">${escapeHtml(parts.bad.trim())}</pre>` : ''}
      ${parts.fix ? `<div class="debug-label fix">怎么改</div>
      <pre class="debug-code-block">${escapeHtml(parts.fix.trim())}</pre>` : ''}
    </div>`;
}

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
      const aiResponse = await this.aiService.sendMessage(prompt, 'coach_debug');
      resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">🔍 分析结果</div><div class="debug-result-body">${renderResult(aiResponse)}</div></div>`;
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
      const aiResponse = await this.aiService.sendMessage(prompt, 'coach_debug');
      resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">👀 对比结果</div><div class="debug-result-body">${renderResult(aiResponse)}</div></div>`;
    } catch (e) {
      resultDiv.innerHTML = `<div class="debug-error">⚠️ 对比失败：${escapeHtml(e.message)}。请检查 AI Key 是否已配置。</div>`;
    } finally {
      btn.disabled = false; btn.textContent = '👀 对比'; this.analyzing = false;
    }
  }
}
