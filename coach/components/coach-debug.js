/**
 * CoachDebugPanel — 教师端 AI 代码诊断面板
 * 粘贴学生代码 → 流式输出结构化诊断报告（问题定位 + 修复方案）
 */
import { escapeHtml, renderMarkdown } from '../../shared/core/utils.js';

export default class CoachDebugPanel {
  constructor(container, { aiService, lessonTitle, homeworkTitle, answerCode, commonMistakes, description }) {
    this.container = container;
    this.aiService = aiService;
    this.context = { lessonTitle, homeworkTitle, answerCode, commonMistakes, description };
    this.analyzing = false;
    this.abortController = null;
  }

  render() {
    const answer = this.context.answerCode || '';
    const title = escapeHtml(this.context.homeworkTitle || '');
    this.container.innerHTML = `
      <div class="debug-panel">
        <div class="debug-header">🔍 代码 Debug — ${title}</div>
        ${answer ? `
        <details class="debug-answer-ref">
          <summary>📋 参考答案</summary>
          <pre><code>${escapeHtml(answer)}</code></pre>
        </details>` : ''}
        <textarea class="debug-input" placeholder="粘贴学生代码，点击分析，AI 会自动对比参考答案找出错误..." rows="6"></textarea>
        <div class="debug-actions">
          <button class="debug-run-btn">🤖 AI 分析代码</button>
          <button class="debug-diff-btn">👀 逐行对比</button>
          <button class="debug-cancel-btn" style="display:none">✖ 取消</button>
        </div>
        <div class="debug-result" style="display:none"></div>
      </div>`;

    this.container.querySelector('.debug-run-btn').addEventListener('click', () => this.analyze());
    this.container.querySelector('.debug-diff-btn').addEventListener('click', () => this.compare());
    this.container.querySelector('.debug-cancel-btn').addEventListener('click', () => this.cancel());
    this.container.querySelector('.debug-input').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') this.analyze();
    });
  }

  /** 切换分析状态：禁用/启用按钮，显示/隐藏取消 */
  _setAnalyzing(state) {
    this.analyzing = state;
    const runBtn = this.container.querySelector('.debug-run-btn');
    const diffBtn = this.container.querySelector('.debug-diff-btn');
    const cancelBtn = this.container.querySelector('.debug-cancel-btn');
    runBtn.disabled = state;
    diffBtn.disabled = state;
    cancelBtn.style.display = state ? 'inline-block' : 'none';
  }

  /** 取消正在进行的请求 */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    const resultDiv = this.container.querySelector('.debug-result');
    resultDiv.innerHTML += '<div class="debug-error">⚠️ 已取消</div>';
    this._setAnalyzing(false);
  }

  /** AI 分析代码 — 找出错误 */
  async analyze() {
    if (this.analyzing) return;
    const input = this.container.querySelector('.debug-input');
    const resultDiv = this.container.querySelector('.debug-result');
    const code = input.value.trim();

    if (!code) {
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<div class="debug-error">⚠️ 请粘贴学生代码后再分析</div>';
      return;
    }

    this._setAnalyzing(true);
    this.abortController = new AbortController();
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="debug-streaming"><span class="debug-streaming-dot"></span> AI 正在逐行推演分析...</div>';

    const prompt = this.aiService.buildDebugContext(
      this.context.lessonTitle, this.context.homeworkTitle,
      this.context.answerCode || '（无参考答案）', code,
      this.context.commonMistakes, this.context.description
    );

    try {
      let fullText = '';
      await this.aiService.streamMessage(prompt, 'coach_debug', (_delta, fullContent) => {
        fullText = fullContent;
        resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">🔍 分析结果</div><div class="debug-result-body">${renderMarkdown(fullText)}</div></div>`;
        resultDiv.scrollTop = resultDiv.scrollHeight;
      }, null, { signal: this.abortController.signal });

      // Final render to ensure complete output
      if (fullText) {
        resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">🔍 分析结果</div><div class="debug-result-body">${renderMarkdown(fullText)}</div></div>`;
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // cancel() already handled
      resultDiv.innerHTML = `<div class="debug-error">⚠️ 分析失败：${escapeHtml(e.message)}。请检查 AI Key 是否已配置。</div>`;
    } finally {
      this.abortController = null;
      this._setAnalyzing(false);
    }
  }

  /** 逐行对比学生代码和参考答案 */
  async compare() {
    if (this.analyzing) return;
    const input = this.container.querySelector('.debug-input');
    const resultDiv = this.container.querySelector('.debug-result');
    const code = input.value.trim();

    if (!code) {
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<div class="debug-error">⚠️ 请粘贴学生代码后再对比</div>';
      return;
    }

    this._setAnalyzing(true);
    this.abortController = new AbortController();
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="debug-streaming"><span class="debug-streaming-dot"></span> AI 正在逐行对比差异...</div>';

    const prompt = this.aiService.buildCompareContext(
      this.context.lessonTitle, this.context.homeworkTitle,
      this.context.answerCode || '（无参考答案）', code, this.context.description
    );

    try {
      let fullText = '';
      await this.aiService.streamMessage(prompt, 'coach_debug', (_delta, fullContent) => {
        fullText = fullContent;
        resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">👀 对比结果</div><div class="debug-result-body">${renderMarkdown(fullText)}</div></div>`;
        resultDiv.scrollTop = resultDiv.scrollHeight;
      }, null, { signal: this.abortController.signal });

      if (fullText) {
        resultDiv.innerHTML = `<div class="debug-result-content ai"><div class="debug-result-badge">👀 对比结果</div><div class="debug-result-body">${renderMarkdown(fullText)}</div></div>`;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      resultDiv.innerHTML = `<div class="debug-error">⚠️ 对比失败：${escapeHtml(e.message)}。请检查 AI Key 是否已配置。</div>`;
    } finally {
      this.abortController = null;
      this._setAnalyzing(false);
    }
  }

  /** 清理资源（CoachLibrary 重新渲染时调用） */
  dispose() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.analyzing = false;
  }
}
