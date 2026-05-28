/**
 * CoachLibrary — 教练版课程列表
 * 题目展示：题目描述/代码/易错/思路/三级提示/动画演示/讲解视频 + Debug面板
 */
import { escapeHtml } from '../../shared/core/utils.js';
import { renderTemplate } from '../../shared/services/gen-prompts.js';
import CoachDebugPanel from './coach-debug.js';

export default class CoachLibrary {
  constructor(container, { stages, lessons, aiService }) {
    this.container = container;
    this.stages = stages;
    this.lessons = lessons;
    this.aiService = aiService;
    this.expandedStages = new Set();
    this.expandedLessons = new Set();
    this.debugPanels = new Map();
    this.hintLevels = new Map(); // problemId → level (0-2)
  }

  render() {
    this.expandedStages.clear(); this.expandedLessons.clear();
    const first = this.stages.find(s => this._filtered(s).length > 0);
    if (first) this.expandedStages.add(first.id);
    this._renderAll();
  }

  _filtered(stage) {
    return this.lessons.filter(l =>
      l.order >= stage.lessonRange[0] && l.order <= stage.lessonRange[1]
    );
  }

  _renderAll() {
    this.container.innerHTML = '';
    this.debugPanels.clear();
    this.stages.forEach(s => {
      const ls = this._filtered(s);
      this._renderStage(s, ls);
    });
    if (!this.stages.length) this.container.innerHTML = '<div class="problem-list-empty">没有课程数据</div>';
  }

  _renderStage(stage, lessons) {
    const wrapper = document.createElement('div'); wrapper.className = 'stage-item';
    const open = this.expandedStages.has(stage.id);
    const header = document.createElement('div'); header.className = 'stage-header';
    header.innerHTML = `<span class="stage-arrow">${open ? '▼' : '▶'}</span>
      <span class="stage-dot" style="background:${stage.color}"></span>
      <div class="stage-info"><span class="stage-name">${escapeHtml(stage.name)}</span><span class="stage-meta">${lessons.length} 课</span></div>`;
    const body = document.createElement('div'); body.className = 'stage-lessons';
    body.style.display = open ? 'block' : 'none';
    header.addEventListener('click', () => {
      this.expandedStages.has(stage.id) ? this.expandedStages.delete(stage.id) : this.expandedStages.add(stage.id);
      this._renderAll();
    });
    lessons.forEach(l => body.appendChild(this._renderLesson(l)));
    wrapper.appendChild(header); wrapper.appendChild(body);
    this.container.appendChild(wrapper);
  }

  _renderLesson(lesson) {
    const wrapper = document.createElement('div'); wrapper.className = 'lesson-item';
    const open = this.expandedLessons.has(lesson.id);
    const num = lesson.order || lesson.id.replace('P', '');

    const header = document.createElement('div'); header.className = 'lesson-header';
    header.innerHTML = `<span class="lesson-arrow">${open ? '▼' : '▶'}</span>
      <span class="lesson-order">${num}</span>
      <div class="lesson-info"><span class="lesson-title">${escapeHtml(lesson.title)}</span>${lesson.password ? `<span class="lesson-password" title="学生解锁密码">🔒 ${escapeHtml(lesson.password)}</span>` : ''}</div>`;

    const body = document.createElement('div'); body.className = 'lesson-body';
    body.style.display = open ? 'block' : 'none';

    header.addEventListener('click', () => {
      this.expandedLessons.has(lesson.id) ? this.expandedLessons.delete(lesson.id) : this.expandedLessons.add(lesson.id);
      this._renderAll();
    });

    // 知识点标签
    if (lesson.knowledgePoints?.length) {
      const kpRow = document.createElement('div'); kpRow.className = 'lesson-kps';
      lesson.knowledgePoints.forEach(k => {
        const tag = document.createElement('span'); tag.className = 'kp-tag';
        tag.textContent = k.name; tag.title = k.detail; kpRow.appendChild(tag);
      });
      body.appendChild(kpRow);
      if (lesson.kpSummary) {
        const sum = document.createElement('div'); sum.className = 'kp-summary';
        sum.textContent = lesson.kpSummary; body.appendChild(sum);
      }
    }

    const sections = [
      { key: 'review', label: '📄 温故知新' },
      { key: 'inClassCodes', label: '📖 课上OJ' },
      { key: 'inClassQuiz', label: '📝 课堂小测' },
      { key: 'homework', label: '📋 课后作业' },
      { key: 'extended', label: '📌 扩展练习' }
    ];
    sections.forEach(({ key, label }) => {
      if (lesson[key]?.length) {
        const sec = document.createElement('div'); sec.className = 'coach-section';
        sec.innerHTML = `<div class="coach-section-title">${label}</div>`;
        lesson[key].forEach(p => sec.appendChild(this._renderProblem(p, lesson)));
        body.appendChild(sec);
      }
    });

    wrapper.appendChild(header); wrapper.appendChild(body);
    if (open) setTimeout(() => this._initDebug(lesson), 0);
    return wrapper;
  }

  _formatThinking(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(s => s.trim());
    const allNumbered = lines.length > 1 && lines.every(s => /^\d+[.、)\s]/.test(s.trim()));
    if (allNumbered) {
      return lines.map(s => {
        const m = s.trim().match(/^(\d+)[.、)\s]\s*(.*)/);
        if (!m) return `<div class="hw-thinking-step"><span class="hw-thinking-text">${escapeHtml(s)}</span></div>`;
        return `<div class="hw-thinking-step"><span class="hw-thinking-num">${m[1]}</span><span class="hw-thinking-text">${escapeHtml(m[2])}</span></div>`;
      }).join('');
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  _renderLectureCard(p, lesson) {
    const wrapper = document.createElement('div');
    wrapper.className = 'homework-item homework-item-lecture';
    const imgUrl = (p.tipsVideos || [])[0] || '';
    const numMatch = (p.title || '').match(/\((\d+)题\)/);
    const numText = numMatch ? numMatch[1] + '道题' : '';
    wrapper.innerHTML = `
      <div class="hw-header">
        <span class="hw-title">📄 ${escapeHtml(p.title || '')}</span>
        <div class="hw-actions">${imgUrl ? '<button class="hw-btn hw-btn-img">📖 查看图片</button>' : ''} <button class="hw-btn hw-btn-copy-link" style="display:none;">📋 复制链接</button></div>
      </div>
      <div class="hw-desc" style="display:none;">
        <div style="text-align:center;margin:12px 0;">
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;" alt="题目图片">` : ''}
          <p style="color:#64748b;font-size:13px;margin-top:8px;">
            ${numText} · ${imgUrl ? `<a href="${escapeHtml(imgUrl)}" target="_blank" style="color:#4f46e5;">在浏览器中打开</a>` : ''}
          </p>
        </div>
      </div>
    `;
    // 复制链接
    const copyBtn = wrapper.querySelector('.hw-btn-copy-link');
    if (copyBtn && imgUrl) {
      copyBtn.style.display = 'inline-block';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(imgUrl).then(() => {
          copyBtn.textContent = '✅ 已复制';
          setTimeout(() => { copyBtn.textContent = '📋 复制链接'; }, 2000);
        });
      });
    }
    // 展开/收起
    const imgBtn = wrapper.querySelector('.hw-btn-img');
    const descDiv = wrapper.querySelector('.hw-desc');
    if (imgBtn && descDiv) {
      imgBtn.addEventListener('click', () => {
        descDiv.style.display = descDiv.style.display === 'none' ? 'block' : 'none';
      });
    }
    return wrapper;
  }

  _renderProblem(p, lesson) {
    if (p.difficulty === 'lecture') return this._renderLectureCard(p, lesson);

    const wrapper = document.createElement('div'); wrapper.className = 'homework-item';
    const code = p.code || p.answerCode || '';
    const hasCode = code.trim().length > 0;
    const hasMistakes = p.commonMistakes?.length > 0;
    const hasDesc = (p.description || '').trim().length > 0;
    const hasThinking = (p.thinking || '').length > 5;
    const hasHints = (p.progressiveHints || []).length >= 3;
    const hasAnim = !!(p.animation?.keyCode?.length || p.animationSteps?.length || p.animationHTML || p.animationFile);
    const hasVideo = !!(p.videoSteps?.length || p.videoHTML || p.videoFile);
    const showMedia = hasCode; // Show anim/video buttons if code exists
    const safeTitle = escapeHtml(p.title || '');

    wrapper.innerHTML = `
      <div class="hw-header" style="flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="hw-title">${safeTitle}</span>
        <div class="hw-actions">
          ${hasDesc ? '<button class="hw-toggle-desc">📄 题目</button>' : ''}
          ${hasCode ? '<button class="hw-toggle-code">📋 代码</button>' : ''}
          ${hasMistakes ? '<button class="hw-toggle-mistakes">⚠️ 易错</button>' : ''}
          ${hasThinking ? '<button class="hw-toggle-thinking">💡 思路</button>' : ''}
          ${hasHints ? '<button class="hw-toggle-hints">🔍 提示</button>' : ''}
          ${showMedia ? `<button class="hw-toggle-anim" style="${!hasAnim ? 'opacity:0.5;' : ''}">🎬 动画演示${!hasAnim ? ' (未生成)' : ''}</button>` : ''}
        </div>
      </div>
      ${hasDesc ? `<div class="hw-desc" style="display:none">${escapeHtml(p.description).replace(/\n/g, '<br>')}</div>` : ''}
      ${hasCode ? `<div class="hw-answer" style="display:none"><pre><code class="language-cpp">${escapeHtml(code)}</code></pre></div>` : ''}
      ${hasMistakes ? `<div class="hw-mistakes" style="display:none">${p.commonMistakes.map(m => `<div class="mistake-item"><span class="mistake-name">⚠ ${escapeHtml(m.mistake)}</span><br><span class="mistake-fix">→ ${escapeHtml(m.fix)}</span></div>`).join('')}</div>` : ''}
      ${hasThinking ? `<div class="hw-thinking" style="display:none">${this._formatThinking(p.thinking)}</div>` : ''}
      ${hasHints ? `<div class="hw-hints" style="display:none;">
        <div class="hw-hint-tabs">
          <button class="hw-hint-tab active" data-hint-level="0">① 思路引导</button>
          <button class="hw-hint-tab" data-hint-level="1">② 代码框架</button>
        </div>
        <div class="hw-hint-header">
          <span class="hw-hint-header-label">① 思路引导</span>
          <span class="hw-hint-header-desc">纯文字提示，引导思考方向</span>
        </div>
        ${(p.progressiveHints).slice(0, 2).map((h, i) => `<div class="hw-hint-content" style="${i > 0 ? 'display:none' : ''}">${i === 0 ? `<div class="hint-text">${escapeHtml(h).replace(/\n/g, '<br>')}</div>` : `<pre><code class="language-cpp">${escapeHtml(typeof h === 'string' ? h : JSON.stringify(h, null, 2))}</code></pre>`}</div>`).join('')}
      </div>` : ''}
      <div class="debug-container" id="debug-${p.id}"></div>`;

    // Toggle buttons
    const toggle = (sel) => {
      const el = wrapper.querySelector(sel); if (!el) return;
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };
    wrapper.querySelector('.hw-toggle-desc')?.addEventListener('click', () => toggle('.hw-desc'));
    wrapper.querySelector('.hw-toggle-code')?.addEventListener('click', () => {
      const el = wrapper.querySelector('.hw-answer');
      const show = el.style.display === 'none';
      el.style.display = show ? 'block' : 'none';
      if (show && window.hljs) el.querySelectorAll('pre code').forEach(c => window.hljs.highlightElement(c));
    });
    wrapper.querySelector('.hw-toggle-mistakes')?.addEventListener('click', () => toggle('.hw-mistakes'));
    wrapper.querySelector('.hw-toggle-thinking')?.addEventListener('click', () => toggle('.hw-thinking'));
    wrapper.querySelector('.hw-toggle-anim')?.addEventListener('click', () => {
      if (!hasAnim) { window._showToast?.('该题暂无动画演示，请在课程管理中生成', 'info'); return; }
      this._openAnimation(p, lesson);
    });

    // Hint tabs: toggle panel + switch between 2 levels
    const hintBtn = wrapper.querySelector('.hw-toggle-hints');
    const hintDiv = wrapper.querySelector('.hw-hints');
    const hintTabs = wrapper.querySelectorAll('.hw-hint-tab');
    const hintContents = wrapper.querySelectorAll('.hw-hint-content');
    const hintHeaderLabel = wrapper.querySelector('.hw-hint-header-label');
    if (hintBtn && hintDiv) {
      const LABELS = ['① 思路引导', '② 代码框架'];
      const DESCS = ['纯文字提示，引导思考方向', '带注释代码，关键位置挖空'];

      hintBtn.addEventListener('click', () => {
        const show = hintDiv.style.display === 'none';
        hintDiv.style.display = show ? 'block' : 'none';
      });

      hintTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const lv = parseInt(tab.dataset.hintLevel);
          hintTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          hintContents.forEach((el, i) => { el.style.display = i === lv ? 'block' : 'none'; });
          if (hintHeaderLabel) hintHeaderLabel.textContent = LABELS[lv];
          const descEl = wrapper.querySelector('.hw-hint-header-desc');
          if (descEl) descEl.textContent = DESCS[lv];
          if (lv === 1 && window.hljs) {
            const code = hintContents[1]?.querySelector('code');
            if (code) window.hljs.highlightElement(code);
          }
        });
      });
    }


    return wrapper;
  }

  _openAnimation(p, lesson) {
    if (p._animBlobUrl) URL.revokeObjectURL(p._animBlobUrl);
    // New template engine format
    if (p.animation?.keyCode?.length) {
      const qid = (p.title || '').match(/\d{4,}/)?.[0] || '0';
      const order = lesson?.order || 61;
      window.open('../animations/template-engine.html#' + order + '-' + qid, '_blank');
      return;
    }
    const steps = p.animationSteps;
    if (steps && steps.length) {
      const voice = this.aiService?.config?.ttsVoice || 'auto';
      const gsapUrl = chrome.runtime.getURL('lib/gsap.min.js');
      const html = renderTemplate(p.title || '动画演示', steps, false, 'coach', voice, gsapUrl);
      const blob = new Blob([html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } else if (p.animationHTML) {
      const blob = new Blob([p.animationHTML], { type: 'text/html' });
      p._animBlobUrl = URL.createObjectURL(blob);
      window.open(p._animBlobUrl, '_blank');
    } else if (p.animationFile) {
      window.open('../animations/' + p.animationFile, '_blank');
    } else {
      window._showToast?.('该题暂无动画演示，请在课程管理中生成', 'info');
    }
  }

  _initDebug(lesson) {
    const all = [
      ...(lesson.review || []),
      ...(lesson.inClassCodes || []),
      ...(lesson.inClassQuiz || []),
      ...(lesson.homework || []),
      ...(lesson.extended || [])
    ];
    all.forEach(p => {
      if (this.debugPanels.has(p.id)) return;
      const c = document.getElementById(`debug-${p.id}`);
      if (!c) return;
      const panel = new CoachDebugPanel(c, {
        aiService: this.aiService,
        lessonTitle: lesson.title,
        homeworkTitle: p.title,
        answerCode: p.code || p.answerCode || '',
        commonMistakes: p.commonMistakes || [],
        description: p.description || ''
      });
      panel.render();
      this.debugPanels.set(p.id, panel);
    });
  }

}
