/**
 * CoachCourseManager — 课程管理弹窗
 */
import { escapeHtml } from '../../shared/core/utils.js';
import { AI_MODELS, API_ENDPOINTS, AI_PROVIDERS } from '../../shared/core/config.js';
import { MD_PARSE_SYSTEM, MISTAKES_SYSTEM, HINTS_SYSTEM, HINTS_USER, ANIMATION_SYSTEM, ANIMATION_USER, VIDEO_SYSTEM, VIDEO_USER, parseStepsJSON } from '../../shared/services/gen-prompts.js';
const CRM = 'https://api-live-class-crm.codemao.cn/live/teacher/class-board';

export default class CoachCourseManager {
  constructor({ onSave, getConfig }) {
    this.onSave = onSave;
    this.getConfig = getConfig;
    this.modal = null;
    this.stages = [];
    this.lessons = [];
    this.parsedData = null;
  }

  open(stages, lessons) { this.stages = [...stages]; this.lessons = [...lessons]; if (this.modal) this.close(); this._render(); }
  close() { if (this.modal) { this.modal.remove(); this.modal = null; } this.parsedData = null; }

  _render() {
    if (this.modal) this.modal.remove();
    this.modal = document.createElement('div');
    this.modal.className = 'course-mgr-modal';
    this.modal.innerHTML = `
      <div class="mgr-content">
        <h3>📚 课程管理</h3>
        <div class="mgr-tabs">
          <button class="mgr-tab active" data-tab="stages">阶段管理</button>
          <button class="mgr-tab" data-tab="lessons">课节管理</button>
          <button class="mgr-tab" data-tab="add">+ 新增课节</button>
        </div>
        <div class="mgr-panel" id="mgrStages">${this._renderStagesHTML()}</div>
        <div class="mgr-panel" id="mgrLessons" style="display:none;"><div class="mgr-lesson-list" id="lessonList"></div></div>
        <div class="mgr-panel" id="mgrAdd" style="display:none;">${this._renderAddHTML()}</div>
        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;"><button class="mgr-btn" id="mgrGenStudentBtn" style="background:#7c3aed;color:#fff;border-color:#7c3aed;">🎓 生成学生版</button><button class="mgr-btn" id="mgrCloseBtn">关闭</button></div>
      </div>`;
    document.body.appendChild(this.modal);
    this._bindEvents();
    this._renderLessonList();
  }

  _renderStagesHTML() {
    return this.stages.map((s, i) => `
      <div class="mgr-stage-item"><span class="mgr-stage-name">${escapeHtml(s.name)} (${this._countLessons(s)}课)</span>
        <div class="mgr-stage-actions"><button class="mgr-btn-sm" data-action="edit-stage" data-idx="${i}">✏</button>
          ${this._countLessons(s) === 0 ? `<button class="mgr-btn-sm mgr-btn-danger" data-action="delete-stage" data-idx="${i}">✖</button>` : ''}
      </div></div>`).join('') + '<button class="mgr-btn" id="addStageBtn">+ 添加阶段</button><div id="stageEditArea" style="display:none;margin-top:10px;"></div>';
  }

  _renderAddHTML() {
    return `<div class="mgr-form">
      <label>1. 输入 classId</label>
      <div class="mgr-input-row"><input type="number" id="mgrClassId" placeholder="如 427"><button class="mgr-btn" id="mgrFetchBtn">拉取课节</button></div>
      <div id="mgrFetchStatus" class="mgr-status"></div>
      <label style="margin-top:8px;">2. 选择课节</label>
      <select id="mgrLessonSelect" style="display:none;"></select>
      <button class="mgr-btn" id="mgrFetchOneBtn" style="display:none;margin-top:6px;">拉取该课题目</button>
      <div id="mgrFetchOneStatus" class="mgr-status"></div>
      <label style="margin-top:8px;">3. 所属阶段</label>
      <select id="mgrStageSelect">${this.stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
      <label style="margin-top:8px;">4. 上传教案 MD</label>
      <input type="file" id="mgrMdFile" accept=".md"><div id="mgrMdStatus" class="mgr-status"></div>
      <label style="margin-top:8px;">5. AI 解析</label>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <button class="mgr-btn" id="mgrAiBtn">🤖 AI解析</button>
        <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" id="mgrGenAnim" checked> 🎬 生成动画演示（作业+扩展）
        </label>
      </div>
      <div id="mgrAiStatus" class="mgr-status"></div>
      <div id="mgrEditForm" style="display:none;margin-top:12px;"></div>
      <div style="margin-top:12px;"><button class="mgr-btn mgr-btn-primary" id="mgrSaveBtn" disabled>💾 保存</button></div>
    </div>`;
  }

  _getAIEndpoint() {
    const config = this.getConfig ? this.getConfig() : {};
    const provider = config.aiProvider || AI_PROVIDERS.DEEPSEEK;
    const endpoint = API_ENDPOINTS[provider] || API_ENDPOINTS[AI_PROVIDERS.DEEPSEEK];
    const providerModels = AI_MODELS[provider];
    const model = (config.model && providerModels && providerModels[config.model]) ? config.model : (providerModels ? Object.keys(providerModels)[0] : 'deepseek-chat');
    return { endpoint, model };
  }

  _isDupPassword(lesson) {
    if (!lesson.password) return false;
    return this.lessons.some(l => l.id !== lesson.id && l.password === lesson.password);
  }

  _countLessons(stage) {
    return this.lessons.filter(l => l.order >= stage.lessonRange[0] && l.order <= stage.lessonRange[1]).length;
  }

  _bindEvents() {
    this.modal.querySelectorAll('.mgr-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.modal.querySelectorAll('.mgr-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.modal.querySelectorAll('.mgr-panel').forEach(p => p.style.display = 'none');
        const t = btn.dataset.tab;
        if (t === 'stages') document.getElementById('mgrStages').style.display = 'block';
        else if (t === 'lessons') { document.getElementById('mgrLessons').style.display = 'block'; this._renderLessonList(); }
        else document.getElementById('mgrAdd').style.display = 'block';
      });
    });

    this.modal.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === 'edit-stage') return this._editStage(parseInt(btn.dataset.idx));
      if (a === 'delete-stage') return this._deleteStage(parseInt(btn.dataset.idx));
      if (a === 'edit-lesson') return this._editLesson(btn.dataset.lid);
      if (a === 'delete-lesson') return this._deleteLesson(btn.dataset.lid);
    });

    document.getElementById('addStageBtn').addEventListener('click', () => this._showStageForm());
    document.getElementById('mgrFetchBtn').addEventListener('click', () => this._fetchLessonList());
    document.getElementById('mgrFetchOneBtn').addEventListener('click', () => this._fetchOneLesson());
    document.getElementById('mgrMdFile').addEventListener('change', (e) => this._handleMdFile(e.target.files[0]));
    document.getElementById('mgrAiBtn').addEventListener('click', () => this._aiGenerate());
    document.getElementById('mgrSaveBtn').addEventListener('click', () => this._saveFromForm());
    document.getElementById('mgrCloseBtn').addEventListener('click', () => this.close());
    document.getElementById('mgrGenStudentBtn').addEventListener('click', () => this._generateStudent());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
  }

  // ============ STAGE MANAGEMENT ============
  _showStageForm(existing = null) {
    const area = document.getElementById('stageEditArea');
    area.style.display = 'block';
    const range = existing?.lessonRange || [0, 0];
    area.innerHTML = `<input id="sn" placeholder="阶段名称" value="${escapeHtml(existing?.name || '')}" style="padding:6px;width:160px;">
      <input id="sc" type="color" value="${existing?.color || '#4CAF50'}">
      <span style="font-size:12px;color:#64748b;">课节范围:</span>
      <input id="sr0" type="number" value="${range[0]}" placeholder="起始" style="padding:4px;width:50px;font-size:12px;">
      <span style="font-size:12px;">-</span>
      <input id="sr1" type="number" value="${range[1]}" placeholder="结束" style="padding:4px;width:50px;font-size:12px;">
      <button id="ss" class="mgr-btn mgr-btn-primary">${existing ? '更新' : '添加'}</button>
      <button id="sx" class="mgr-btn">取消</button>`;
    document.getElementById('ss').addEventListener('click', () => {
      const n = document.getElementById('sn').value.trim(), c = document.getElementById('sc').value;
      const r0 = parseInt(document.getElementById('sr0').value) || 0;
      const r1 = parseInt(document.getElementById('sr1').value) || 0;
      if (!n) return;
      if (existing) { existing.name = n; existing.color = c; existing.lessonRange = [r0, r1]; } else {
        const maxId = this.stages.reduce((max, s) => { const m = (s.id || '').match(/C(\d+)/); return m ? Math.max(max, parseInt(m[1])) : max; }, 0);
        this.stages.push({ id: 'C' + (maxId + 1), name: n, color: c, lessonRange: [r0, r1] });
      }
      this._saveAll();
      // Only refresh stage panel, don't rebuild entire modal
      area.innerHTML = ''; area.style.display = 'none';
      const stagesPanel = document.getElementById('mgrStages');
      if (stagesPanel) stagesPanel.innerHTML = this._renderStagesHTML();
      const addBtn = document.getElementById('addStageBtn');
      if (addBtn) addBtn.addEventListener('click', () => this._showStageForm());
    });
    document.getElementById('sx').addEventListener('click', () => { area.innerHTML = ''; area.style.display = 'none'; });
  }

  _recalcStageRanges() {
    for (const s of this.stages) {
      const inRange = this.lessons.filter(l => l.order >= s.lessonRange[0] && l.order <= s.lessonRange[1]);
      if (inRange.length > 0) {
        const orders = inRange.map(l => l.order);
        s.lessonRange = [Math.min(...orders), Math.max(...orders)];
      }
    }
  }
  _editStage(idx) { this._showStageForm(this.stages[idx]); }
  _deleteStage(idx) { this.stages.splice(idx, 1); this._saveAll(); this._render(); }

  // ============ LESSON MANAGEMENT ============
  _renderLessonList() {
    const c = document.getElementById('lessonList'); if (!c) return;
    c.innerHTML = `<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center;">
      <label style="font-size:12px;cursor:pointer;"><input type="checkbox" id="mgrSelectAll"> 全选</label>
      <button class="mgr-btn-sm mgr-btn-danger" id="mgrBatchDelete" style="display:none;">✖ 批量删除</button>
    </div>` + this.lessons.map(l => `<div class="mgr-lesson-item">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" class="mgr-lesson-check" data-lid="${l.id}">
        <span>${escapeHtml(l.id)} ${escapeHtml(l.title)}${l.password ? ` <span style="font-size:11px;color:${this._isDupPassword(l) ? '#ef4444' : '#f59e0b'};background:#fffbeb;padding:1px 6px;border-radius:8px;">🔒 ${escapeHtml(l.password)}${this._isDupPassword(l) ? ' ⚠️重复' : ''}</span>` : ''}</span>
      </label>
      <div><button class="mgr-btn-sm" data-action="edit-lesson" data-lid="${l.id}">✏</button>
      <button class="mgr-btn-sm mgr-btn-danger" data-action="delete-lesson" data-lid="${l.id}">✖</button></div></div>`).join('');

    // Batch delete bindings
    const selectAll = document.getElementById('mgrSelectAll');
    const batchBtn = document.getElementById('mgrBatchDelete');
    const checks = c.querySelectorAll('.mgr-lesson-check');
    const updateBatchBtn = () => {
      const any = c.querySelectorAll('.mgr-lesson-check:checked').length > 0;
      if (batchBtn) batchBtn.style.display = any ? 'inline-block' : 'none';
    };
    if (selectAll) {
      selectAll.addEventListener('change', () => { checks.forEach(ch => ch.checked = selectAll.checked); updateBatchBtn(); });
    }
    checks.forEach(ch => ch.addEventListener('change', updateBatchBtn));
    if (batchBtn) {
      batchBtn.addEventListener('click', () => this._batchDelete());
    }
  }

  _editLesson(lid) {
    const lesson = this.lessons.find(l => l.id === lid); if (!lesson) return;
    // Switch to add tab with pre-filled form
    this.modal.querySelectorAll('.mgr-tab').forEach(b => b.classList.remove('active'));
    this.modal.querySelector('[data-tab="add"]').classList.add('active');
    document.getElementById('mgrStages').style.display = 'none';
    document.getElementById('mgrLessons').style.display = 'none';
    document.getElementById('mgrAdd').style.display = 'block';
    document.getElementById('mgrStageSelect').value = this._findStage(lesson).id;
    this._renderStructuredForm(lesson);
    document.getElementById('mgrSaveBtn').disabled = false;
    document.getElementById('mgrSaveBtn').textContent = '💾 更新课节';
    document.getElementById('mgrSaveBtn').dataset.editId = lid;
  }

  _findStage(lesson) { return this.stages.find(s => lesson.order >= s.lessonRange[0] && lesson.order <= s.lessonRange[1]) || this.stages[0] || { id: 'C1' }; }

  _deleteLesson(lid) {
    if (!confirm('确定删除 ' + lid + '？')) return;
    const lesson = this.lessons.find(l => l.id === lid);
    if (!lesson) return;
    // Backup
    chrome.storage.local.get('csp_lessons_backup', (r) => {
      const backups = r.csp_lessons_backup || [];
      backups.push({ time: new Date().toISOString(), lessons: [lesson] });
      chrome.storage.local.set({ csp_lessons_backup: backups.slice(-5) });
    });
    this.lessons = this.lessons.filter(l => l.id !== lid);
    this._recalcStageRanges();
    this._saveAll(); this._refreshUI();
  }

  _batchDelete() {
    const checked = [...document.querySelectorAll('.mgr-lesson-check:checked')].map(c => c.dataset.lid);
    if (!checked.length) return;
    if (!confirm(`确定删除 ${checked.length} 个课节？\n数据会备份到 chrome.storage.local`)) return;
    // Backup before delete
    const backup = this.lessons.filter(l => checked.includes(l.id));
    chrome.storage.local.get('csp_lessons_backup', (r) => {
      const backups = r.csp_lessons_backup || [];
      backups.push({ time: new Date().toISOString(), lessons: backup });
      chrome.storage.local.set({ csp_lessons_backup: backups.slice(-5) }); // keep last 5 backups
    });
    this.lessons = this.lessons.filter(l => !checked.includes(l.id));
    this._recalcStageRanges();
    this._saveAll();
    this._refreshUI();
  }

  _refreshUI() {
    this._renderLessonList();
    const stagesPanel = document.getElementById('mgrStages');
    if (stagesPanel) { stagesPanel.innerHTML = this._renderStagesHTML(); }
    // Re-bind addStageBtn since the stages HTML was replaced
    const addBtn = document.getElementById('addStageBtn');
    if (addBtn) addBtn.addEventListener('click', () => this._showStageForm());
  }

  // ============ FETCH FROM CRM ============
  async _fetchLessonList() {
    const classId = document.getElementById('mgrClassId').value.trim();
    const s = document.getElementById('mgrFetchStatus');
    if (!classId) { s.innerHTML = '<span style="color:red">请输入 classId</span>'; return; }
    s.innerHTML = '⏳ 拉取中...';
    try {
      const r = await fetch(`${CRM}/lessons/all?classId=${classId}&limitLocked=true`, { credentials: 'include' });
      const d = await r.json(); this._fetchedLessons = d.data || [];
      const sel = document.getElementById('mgrLessonSelect');
      sel.style.display = 'block'; sel.innerHTML = this._fetchedLessons.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
      document.getElementById('mgrFetchOneBtn').style.display = 'inline-block';
      s.innerHTML = `<span style="color:green">✅ ${this._fetchedLessons.length} 课</span>`;
    } catch (e) { s.innerHTML = `<span style="color:red">${escapeHtml(e.message)}</span>`; }
  }

  async _fetchOneLesson() {
    const lid = document.getElementById('mgrLessonSelect').value;
    const s = document.getElementById('mgrFetchOneStatus');
    if (!lid) return;
    s.innerHTML = '⏳ 拉取题目...';
    try {
      const r = await fetch(`${CRM}/courses/overall/static?lessonId=${lid}`, { credentials: 'include' });
      const d = await r.json();
      const info = this._fetchedLessons.find(l => String(l.id) === String(lid));
      this._fetchedData = [{ lessonInfo: info, courses: d.data || [] }];
      s.innerHTML = '<span style="color:green">✅ 题目已拉取</span>';
    } catch (e) { s.innerHTML = `<span style="color:red">${escapeHtml(e.message)}</span>`; }
  }

  _handleMdFile(file) {
    if (!file) return; const s = document.getElementById('mgrMdStatus');
    s.innerHTML = '⏳ 读取中...';
    const reader = new FileReader();
    reader.onload = (e) => { this._mdContent = e.target.result; s.innerHTML = `<span style="color:green">✅ 已读取 (${this._mdContent.length} 字)</span>`; };
    reader.onerror = () => { s.innerHTML = '<span style="color:red">读取失败</span>'; };
    reader.readAsText(file);
  }

  // ============ AI GENERATION ============
  async _aiGenerate() {
    const s = document.getElementById('mgrAiStatus');
    const config = this.getConfig ? this.getConfig() : { apiKey: '' };
    const apiKey = config.apiKey;
    if (!apiKey) { s.innerHTML = '<span style="color:red">请先配置 AI Key</span>'; return; }
    if (!this._fetchedData) { s.innerHTML = '<span style="color:red">请先拉取题目</span>'; return; }
    if (!this._mdContent) { s.innerHTML = '<span style="color:red">请先上传教案 MD</span>'; return; }

    s.innerHTML = '⏳ AI 解析中...';
    let parsedMD = null;
    try {
      const { endpoint, model } = this._getAIEndpoint();
      const resp = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 8192,
          messages: [{ role: 'system', content: MD_PARSE_SYSTEM },
          { role: 'user', content: this._mdContent.substring(0, 16000) }] })
      });
      const d = await resp.json();
      const t = d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
      parsedMD = JSON.parse(t.substring(t.indexOf('{'), t.lastIndexOf('}') + 1));
    } catch (e) { s.innerHTML = `<span style="color:red">MD解析失败: ${escapeHtml(e.message)}</span>`; return; }

    // Build lesson from OJ data
    const item = this._fetchedData[0];
    const li = item.lessonInfo;
    const numMatch = (li.name || '').match(/P(\d+)/);
    const num = numMatch ? parseInt(numMatch[1]) : this.lessons.length + 1;

    const review = [], inClassCodes = [], inClassQuiz = [], homework = [], extended = [];
    for (const course of (item.courses || [])) {
      for (const link of (course.linkList || [])) {
        const steps = (link.normalDetail || {}).stepList || [];
        const linkName = (link.name || '').toLowerCase();
        for (const step of steps) {
          // 讲义题 (courseQuestionDetail, type 22)
          if (step.type === 22) {
            const cq = step.courseQuestionDetail || {};
            const num = cq.num || 0;
            const coverUrl = cq.coverUrl || '';
            const prob = { title: (step.name || '讲义') + (num ? ` (${num}题)` : ''), description: `题目数量: ${num}\n题目图片: ${coverUrl}`, code: '', answerCode: '', commonMistakes: [], progressiveHints: [], difficulty: 'lecture' };
            if (linkName.includes('温故知新')) review.push(prob);
            else if (linkName.includes('小测')) inClassQuiz.push(prob);
            else if (linkName.includes('作业')) homework.push(prob);
            else if (linkName.includes('拓展') || linkName.includes('扩展')) extended.push(prob);
            else inClassQuiz.push(prob); // 默认归入课堂小测
            continue;
          }
          // 代码题 (ojCppDetail, type 21)
          if (step.type !== 21) continue;
          const oj = step.ojCppDetail || {}; if (!oj.questionId) continue;
          let desc = (oj.description || '').replace(/<[^>]+>/g, '').trim();
          const oi = oj.ojInfo || {};
          if (oi.inputType) desc += '\n【输入格式】\n' + (oi.inputType || '').replace(/<[^>]+>/g, '').trim();
          if (oi.outputType) desc += '\n【输出格式】\n' + (oi.outputType || '').replace(/<[^>]+>/g, '').trim();
          if (oi.example?.length) oi.example.forEach((ex, ei) => { desc += '\n【样例' + (ei + 1) + '】\n输入：' + (ex.in || '') + '\n输出：' + (ex.out || ''); });
          const prob = { title: step.name || ('题' + (inClassCodes.length + homework.length + extended.length + 1)), description: desc, code: '', answerCode: '', commonMistakes: [], progressiveHints: [] };
          if (linkName.includes('作业')) homework.push(prob);
          else if (linkName.includes('拓展') || linkName.includes('扩展')) extended.push(prob);
          else if (linkName.includes('温故知新')) review.push(prob);
          else if (linkName.includes('小测')) inClassQuiz.push(prob);
          else inClassCodes.push(prob);
        }
      }
    }

    // Extract ALL code blocks from MD directly (as fallback, more reliable than AI)
    const directCodes = [];
    const codeRegex = /```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/g;
    let cm;
    while ((cm = codeRegex.exec(this._mdContent)) !== null) {
      const c = cm[1].trim();
      if (c.length > 20 && c.includes('int main')) directCodes.push(c);
    }

    // Merge AI codes + direct codes (prefer longer ones)
    const aiCodes = (parsedMD.codes || []).map(c => c.code).filter(c => c && c.length > 20);
    const allCodes = [...aiCodes];
    // Add direct codes not already included
    for (const dc of directCodes) {
      if (!allCodes.some(ac => ac.includes(dc.substring(0, 50)) || dc.includes(ac.substring(0, 50)))) {
        allCodes.push(dc);
      }
    }

    // Assign codes evenly across code-only groups
    const groups = [
      { problems: review, name: 'review' },
      { problems: inClassCodes, name: 'oj' },
      { problems: inClassQuiz, name: 'quiz' },
      { problems: homework, name: 'hw' },
      { problems: extended, name: 'ex' }
    ];
    let ci = 0;
    // Round-robin: give one code to each group in turn
    while (ci < allCodes.length) {
      let assigned = false;
      for (const g of groups) {
        const next = g.problems.find(p => !p.code && !p.answerCode);
        if (next && ci < allCodes.length) {
          next.code = allCodes[ci];
          next.answerCode = allCodes[ci];
          ci++;
          assigned = true;
        }
      }
      if (!assigned) break; // no more problems need codes
    }

    // AI generate mistakes
    s.innerHTML = '⏳ 生成易错点...';
    for (const p of [...homework, ...extended]) {
      if (!p.answerCode || p.answerCode.length < 30) continue;
      try {
        const { endpoint: e2, model: m2 } = this._getAIEndpoint();
        const mr = await fetch(e2, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({ model: m2, temperature: 0, max_tokens: 300,
            messages: [{ role: 'system', content: MISTAKES_SYSTEM }, { role: 'user', content: p.answerCode.substring(0, 800) }] }) });
        const md = await mr.json();
        const mt = md.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
        p.commonMistakes = JSON.parse(mt.substring(mt.indexOf('['), mt.lastIndexOf(']') + 1));
      } catch (e) { }
    }

    // AI generate thinking + hints for all problems with code
    const allProblems = [...inClassCodes, ...homework, ...extended].filter(p => (p.answerCode || '').length > 30);
    s.innerHTML = '⏳ 生成思路+提示...';
    let hiDone = 0;
    for (const p of allProblems) {
      try {
        const data = await this._aiGenerateHints(p.answerCode, li.name || '', apiKey);
        if (data) {
          p.thinking = data.thinking || '';
          p.progressiveHints = data.hints || [];
          hiDone++;
        }
      } catch (e) { }
      s.innerHTML = `⏳ 思路+提示 ${hiDone}/${allProblems.length}`;
    }

    // AI generate animations if checkbox checked
    let animDone = 0;
    const doAnim = document.getElementById('mgrGenAnim')?.checked;
    if (doAnim) {
      const animProblems = [...homework, ...extended].filter(p => (p.answerCode || '').length > 30);
      s.innerHTML = `⏳ 动画 0/${animProblems.length}`;
      for (const p of animProblems) {
        try {
          const steps = await this._aiGenerateAnimation(p.answerCode, p.title || '', li.name || '', apiKey);
          if (steps) {
            p.animationSteps = steps;
            p.animationFile = 'anim_' + num + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';
            animDone++;
          }
        } catch (e) { }
        s.innerHTML = `⏳ 动画 ${animDone}/${animProblems.length}`;
      }
    }

    this._parsedLesson = { id: 'P' + num, title: li.name || '第' + num + '课', order: num, kpSummary: parsedMD.kpSummary || '', knowledgePoints: parsedMD.knowledgePoints || [], tags: [], review, inClassCodes, inClassQuiz, homework, extended };
    this._renderStructuredForm(this._parsedLesson);
    document.getElementById('mgrSaveBtn').disabled = false; delete document.getElementById('mgrSaveBtn').dataset.editId;
    document.getElementById('mgrSaveBtn').textContent = '💾 保存新课';
    s.innerHTML = `<span style="color:green">✅ 完成（思路+提示:${hiDone}, 动画:${animDone}），请修改后保存</span>`;
  }

  // ============ STRUCTURED FORM ============
  _renderStructuredForm(lesson) {
    const container = document.getElementById('mgrEditForm');
    container.style.display = 'block';
    const groups = [
      { label: '📄 温故知新', key: 'review' },
      { label: '📖 课上OJ', key: 'inClassCodes' },
      { label: '📝 课堂小测', key: 'inClassQuiz' },
      { label: '📋 课后作业', key: 'homework' },
      { label: '📌 扩展练习', key: 'extended' }
    ];

    let html = `<div style="margin-bottom:8px;display:flex;gap:8px;">
      <input id="mgrEditTitle" value="${escapeHtml(lesson.title || '')}" placeholder="课节标题" style="flex:1;padding:8px;font-size:14px;font-weight:600;border:1px solid #e2e8f0;border-radius:6px;">
      <input id="mgrEditPassword" value="${escapeHtml(lesson.password || '')}" placeholder="🔒 解锁密码（留空=不锁定）" style="width:200px;padding:8px;font-size:13px;border:1px solid #f59e0b;border-radius:6px;background:#fffbeb;">
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:4px;">📝 课程概述</div>
      <input id="mgrKpSummary" value="${escapeHtml(lesson.kpSummary || '')}" placeholder="一句话概括本课学什么..." style="width:100%;padding:8px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;">
    </div>
    <div style="margin-bottom:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;">
      <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:4px;">🏷️ 知识点标签</div>
      <div id="mgrKpList" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;min-height:24px;">${(lesson.knowledgePoints || []).map((k, i) => `<span class="mgr-kp-chip">${escapeHtml(k.name)}${k.detail ? ': ' + escapeHtml(k.detail) : ''} <button class="mgr-kp-del" data-idx="${i}" style="cursor:pointer;background:none;border:none;font-size:14px;color:#94a3b8;">×</button></span>`).join('')}</div>
      <div style="display:flex;gap:4px;">
        <input id="mgrKpName" placeholder="知识点名称" style="flex:1;padding:4px 8px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px;">
        <input id="mgrKpDetail" placeholder="一句话解释（可选）" style="flex:1;padding:4px 8px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px;">
        <button id="mgrKpAdd" class="mgr-btn-sm" style="color:#3b82f6;border-color:#3b82f6;white-space:nowrap;">+ 添加</button>
      </div>
    </div>`;

    groups.forEach(g => {
      const problems = lesson[g.key] || [];
      if (!problems.length) return;
      html += `<div style="margin-bottom:10px;"><h4 style="font-size:13px;color:#475569;margin:0 0 4px 0;">${g.label} (${problems.length}题)</h4>`;
      problems.forEach((p, i) => {
        const code = p.code || p.answerCode || '';
        const hasCode = code.length > 20;
        const hasDesc = (p.description || '').length > 10;
        const hasThinking = (p.thinking || '').length > 5;
        const hasHints = (p.progressiveHints || []).length >= 3;
        const hasAnim = !!(p.animationSteps?.length || p.animationHTML || p.animationFile);
        const statusIcon = hasCode ? '✅' : '❌';
        const statusParts = [hasCode ? '代码' : '', hasDesc ? '描述' : '', hasThinking ? '思路' : '', hasHints ? '提示' : '', hasAnim ? '动画' : ''].filter(Boolean).join('|');
        const missingParts = [!hasThinking && '思路', !hasHints && '提示', (!hasAnim && hasCode) && '动画'].filter(Boolean);
        const hasMissing = missingParts.length > 0;
        const mistakes = (p.commonMistakes || []).map(m => m.mistake + ' → ' + m.fix).join('\n');
        const hints = p.progressiveHints || [];
        const pid = 'ep_' + g.key + '_' + i;
        const fillBtn = hasMissing ? `<button class="mgr-btn-sm mgr-fill-missing" data-group="${g.key}" data-idx="${i}" style="color:#f59e0b;border-color:#f59e0b;font-size:10px;padding:2px 6px;" title="补生成：${missingParts.join('、')}">🤖 补生成</button>` : '';
        html += `<div class="mgr-prob-card" style="border:1px solid ${hasCode?'#bbf7d0':'#fde68a'};border-radius:6px;margin-bottom:6px;overflow:hidden;">
          <div class="mgr-prob-header" data-pid="${pid}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:${hasCode?'#f0fdf4':'#fffbeb'};cursor:pointer;font-size:13px;">
            <span>${statusIcon} ${escapeHtml(p.title || '题'+(i+1))} ${fillBtn}</span>
            <span style="font-size:11px;color:#94a3b8;">${statusParts || '缺数据'} ▸</span>
          </div>
          <div class="mgr-prob-body" data-pid="${pid}" style="display:none;padding:8px 10px;background:#fff;">
            <label style="font-size:11px;color:#94a3b8;">标题</label>
            <input data-group="${g.key}" data-idx="${i}" data-field="title" value="${escapeHtml(p.title || '')}" style="width:100%;padding:4px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:6px;">
            <label style="font-size:11px;color:#94a3b8;">描述</label>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="description" style="width:100%;padding:8px;font-size:12px;line-height:1.6;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:6px;min-height:100px;resize:vertical;">${escapeHtml(p.description || '')}</textarea>
            <label style="font-size:11px;color:#94a3b8;">代码</label>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="code" style="width:100%;padding:8px;font-family:SF Mono,Monaco,monospace;font-size:13px;line-height:1.5;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:6px;min-height:150px;resize:vertical;background:#1e1e1e;color:#d4d4d4;">${escapeHtml(code)}</textarea>
            <label style="font-size:11px;color:#94a3b8;">常见错误（错误 → 改正，每行一条）</label>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="mistakes" style="width:100%;padding:4px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px;min-height:40px;resize:vertical;">${escapeHtml(mistakes)}</textarea>
            <label style="font-size:11px;color:#94a3b8;margin-top:6px;">💡 解题思路</label>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="thinking" style="width:100%;padding:8px;font-size:12px;line-height:1.6;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:6px;min-height:60px;resize:vertical;">${escapeHtml(p.thinking || '')}</textarea>
            <label style="font-size:11px;color:#94a3b8;">🔍 三级提示</label>
            <div class="mgr-hint-tabs" style="display:flex;gap:4px;margin:4px 0;">
              <button class="mgr-hint-tab active" data-pid="${pid}" data-level="0">第1级</button>
              <button class="mgr-hint-tab" data-pid="${pid}" data-level="1">第2级</button>
              <button class="mgr-hint-tab" data-pid="${pid}" data-level="2">第3级</button>
            </div>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="hint0" class="mgr-hint-area" data-pid="${pid}" data-level="0" style="width:100%;padding:8px;font-family:SF Mono,Monaco,monospace;font-size:13px;line-height:1.5;border:1px solid #e2e8f0;border-radius:4px;min-height:100px;resize:vertical;background:#1e1e1e;color:#d4d4d4;">${escapeHtml(hints[0] || '')}</textarea>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="hint1" class="mgr-hint-area" data-pid="${pid}" data-level="1" style="display:none;width:100%;padding:8px;font-family:SF Mono,Monaco,monospace;font-size:13px;line-height:1.5;border:1px solid #e2e8f0;border-radius:4px;min-height:100px;resize:vertical;background:#1e1e1e;color:#d4d4d4;">${escapeHtml(hints[1] || '')}</textarea>
            <textarea data-group="${g.key}" data-idx="${i}" data-field="hint2" class="mgr-hint-area" data-pid="${pid}" data-level="2" style="display:none;width:100%;padding:8px;font-family:SF Mono,Monaco,monospace;font-size:13px;line-height:1.5;border:1px solid #e2e8f0;border-radius:4px;min-height:100px;resize:vertical;background:#1e1e1e;color:#d4d4d4;">${escapeHtml(hints[2] || '')}</textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <span style="font-size:11px;color:#94a3b8;">🎬 动画：</span>
              <span class="mgr-anim-status" style="font-size:12px;color:${hasAnim?'#16a34a':'#94a3b8'};">${p.animationSteps?.length ? '已生成 (' + p.animationSteps.length + '步)' : p.animationHTML ? '已嵌入' : hasAnim ? escapeHtml(p.animationFile) : '未生成'}</span>
              ${hasCode ? `<button class="mgr-btn-sm mgr-regen-anim" data-group="${g.key}" data-idx="${i}" style="color:#7c3aed;border-color:#7c3aed;">🔄 重新生成</button>` : ''}
            </div>
          </div>
        </div>`;
      });
      html += '</div>';
    });

    container.innerHTML = html;

    // Toggle card expand
    container.querySelectorAll('.mgr-prob-header').forEach(h => {
      h.addEventListener('click', () => {
        const body = container.querySelector(`.mgr-prob-body[data-pid="${h.dataset.pid}"]`);
        const show = body.style.display === 'none';
        body.style.display = show ? 'block' : 'none';
        h.querySelector('span:last-child').textContent = (show ? '▾' : '▸') + ' ' + h.querySelector('span:last-child').textContent.split(' ').slice(1).join(' ');
      });
    });

    // Hint tab switching
    container.querySelectorAll('.mgr-hint-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = tab.dataset.pid;
        const tabs = container.querySelectorAll(`.mgr-hint-tab[data-pid="${pid}"]`);
        const areas = container.querySelectorAll(`.mgr-hint-area[data-pid="${pid}"]`);
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        areas.forEach(a => { a.style.display = a.dataset.level === tab.dataset.level ? 'block' : 'none'; });
      });
    });

    // Animation regenerate button
    container.querySelectorAll('.mgr-regen-anim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const group = btn.dataset.group;
        const idx = parseInt(btn.dataset.idx);
        this._regenerateSingleAnimation(group, idx);
      });
    });

    // Video regenerate button
    container.querySelectorAll('.mgr-regen-video').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const group = btn.dataset.group;
        const idx = parseInt(btn.dataset.idx);
        this._regenerateSingleVideo(group, idx);
      });
    });

    // Fill missing button
    container.querySelectorAll('.mgr-fill-missing').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const group = btn.dataset.group;
        const idx = parseInt(btn.dataset.idx);
        this._fillMissing(group, idx);
      });
    });

    // Knowledge points editor
    const kpList = document.getElementById('mgrKpList');
    const kpAdd = document.getElementById('mgrKpAdd');
    const kpName = document.getElementById('mgrKpName');
    const kpDetail = document.getElementById('mgrKpDetail');
    const renderKp = () => {
      if (!kpList) return;
      const kps = this._getEditLesson()?.knowledgePoints || [];
      kpList.innerHTML = kps.map((k, i) => `<span class="mgr-kp-chip">${escapeHtml(k.name)}${k.detail ? ': ' + escapeHtml(k.detail) : ''} <button class="mgr-kp-del" data-idx="${i}" style="cursor:pointer;background:none;border:none;font-size:14px;color:#94a3b8;">×</button></span>`).join('');
      kpList.querySelectorAll('.mgr-kp-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx);
          const lesson = this._getEditLesson();
          if (lesson?.knowledgePoints) { lesson.knowledgePoints.splice(idx, 1); renderKp(); }
        });
      });
    };
    // Bind initial delete buttons
    kpList?.querySelectorAll('.mgr-kp-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const lesson = this._getEditLesson();
        if (lesson?.knowledgePoints) { lesson.knowledgePoints.splice(idx, 1); renderKp(); }
      });
    });
    kpAdd?.addEventListener('click', () => {
      const name = kpName?.value?.trim();
      if (!name) return;
      const lesson = this._getEditLesson();
      if (lesson && !lesson.knowledgePoints) lesson.knowledgePoints = [];
      lesson?.knowledgePoints?.push({ name, detail: kpDetail?.value?.trim() || '' });
      if (kpName) kpName.value = '';
      if (kpDetail) kpDetail.value = '';
      renderKp();
    });
    // CSS for kp chips
    if (!document.getElementById('mgr-kp-styles')) {
      const style = document.createElement('style');
      style.id = 'mgr-kp-styles';
      style.textContent = '.mgr-kp-chip{display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:10px;font-size:11px;background:#eff6ff;color:#3b82f6;font-weight:500;}.mgr-kp-del:hover{color:#ef4444;}';
      document.head.appendChild(style);
    }
  }

  _getEditLesson() {
    const editId = document.getElementById('mgrSaveBtn')?.dataset?.editId;
    if (editId) return this.lessons.find(l => l.id === editId);
    return this._parsedLesson;
  }

  _saveFromForm() {
    const title = document.getElementById('mgrEditTitle')?.value || '';
    const editId = document.getElementById('mgrSaveBtn').dataset.editId;

    let lesson;
    if (editId) {
      lesson = this.lessons.find(l => l.id === editId);
      if (!lesson) return;
    } else if (this._parsedLesson) {
      lesson = this._parsedLesson;
    } else {
      return;
    }

    lesson.title = title;
    lesson.kpSummary = document.getElementById('mgrKpSummary')?.value?.trim() || '';
    lesson.password = document.getElementById('mgrEditPassword')?.value?.trim() || '';

    // Check for duplicate password
    if (lesson.password && this._isDupPassword(lesson)) {
      if (!confirm(`密码 "${lesson.password}" 和其他课重复，仍要保存？`)) return;
    }

    // Collect form data
    document.querySelectorAll('[data-group]').forEach(el => {
      const group = el.dataset.group;
      const idx = parseInt(el.dataset.idx);
      const field = el.dataset.field;
      const value = el.value || '';

      if (!lesson[group] || idx >= lesson[group].length) return;
      const p = lesson[group][idx];

      if (field === 'title') p.title = value;
      else if (field === 'description') p.description = value;
      else if (field === 'code') { p.code = value; p.answerCode = value; }
      else if (field === 'thinking') p.thinking = value;
      else if (field === 'hint0' || field === 'hint1' || field === 'hint2') {
        if (!p.progressiveHints) p.progressiveHints = ['', '', ''];
        const hi = parseInt(field.replace('hint', ''));
        p.progressiveHints[hi] = value;
      }
      else if (field === 'mistakes') {
        p.commonMistakes = value.split('\n').filter(l => l.includes('→')).map(l => {
          const [mistake, fix] = l.split('→').map(s => s.trim());
          return { mistake: mistake || '', fix: fix || '' };
        });
      }
    });

    // Update stage range if needed
    const stageId = document.getElementById('mgrStageSelect')?.value;
    const stage = this.stages.find(s => s.id === stageId);
    if (stage && lesson.order) {
      if (stage.lessonRange[0] === 0 || lesson.order < stage.lessonRange[0]) stage.lessonRange[0] = lesson.order;
      if (lesson.order > stage.lessonRange[1]) stage.lessonRange[1] = lesson.order;
    }

    if (!editId) {
      const idx = this.lessons.findIndex(l => l.id === lesson.id);
      if (idx >= 0 && !confirm(`课节 ${lesson.id} 已存在，是否覆盖？`)) return;
      if (idx >= 0) this.lessons[idx] = lesson; else this.lessons.push(lesson);
      this.lessons.sort((a, b) => a.order - b.order);
    }

    this._saveAll();
    this._renderLessonList();
    document.getElementById('mgrEditForm').style.display = 'none';
    document.getElementById('mgrSaveBtn').disabled = true;
    document.getElementById('mgrAiStatus').innerHTML = '<span style="color:green">✅ 已保存</span>';
  }

  _saveAll() {
    if (this.onSave) this.onSave({ stages: this.stages, lessons: this.lessons });
  }

  // ============ GENERATE STUDENT VERSION ============
  async _generateStudent() {
    console.log('[CourseMgr] Generate student clicked, lessons:', this.lessons?.length);
    // Show config dialog first
    const aiConfig = await this._showStudentConfigDialog();
    console.log('[CourseMgr] Dialog result:', aiConfig);
    if (aiConfig === null) return; // User cancelled

    const status = document.createElement('div');
    status.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;z-index:9999;font-size:13px;font-weight:600;';
    status.textContent = '⏳ 准备学生版数据...';
    document.body.appendChild(status);

    try {

    const studentLessons = JSON.parse(JSON.stringify(this.lessons));
    const config = this.getConfig ? this.getConfig() : { apiKey: '' };
    const apiKey = config.apiKey;

    // Collect problems and check for missing hints (only code sections that need hints)
    let missingHints = 0;
    const allProblems = [];
    for (const l of studentLessons) {
      for (const p of [...(l.inClassCodes || []), ...(l.homework || []), ...(l.extended || [])]) {
        const code = p.code || p.answerCode || '';
        if (!code || code.length < 30) continue;
        allProblems.push({ lesson: l, problem: p, code });
        if (!p.thinking || !p.progressiveHints || p.progressiveHints.length < 3) missingHints++;
      }
    }

    // Generate missing hints + thinking
    if (missingHints > 0 && apiKey) {
      let done = 0;
      status.textContent = `⏳ 补生成思路+提示 ${done}/${missingHints}`;
      for (const item of allProblems) {
        const p = item.problem;
        if (p.thinking && p.progressiveHints && p.progressiveHints.length >= 3) continue;
        try {
          const r = await this._aiGenerateHints(item.code, item.lesson.title, apiKey);
          if (r) { p.thinking = r.thinking || ''; p.progressiveHints = r.hints || []; done++; }
        } catch (e) { }
        status.textContent = `⏳ 补生成思路+提示 ${done}/${missingHints}`;
      }
    }

    // Step 3: Strip answers + video data
    status.textContent = '⏳ 打包中...';
    for (const l of studentLessons) {
      l.password = l.password || '';
      for (const p of [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])]) {
        p.code = ''; p.answerCode = '';
        delete p.answerNotes; delete p.commentary;
        delete p.videoSteps; delete p.videoHTML; delete p.videoFile;
      }
    }

    // Build student data JSON download
    const studentData = { lessons: studentLessons, aiConfig, version: '2.0', generatedAt: new Date().toISOString() };
    const json = JSON.stringify(studentData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lessons-student.json';
    a.click();
    URL.revokeObjectURL(url);

    status.innerHTML = `✅ 已下载 lessons-student.json<br><span style="font-size:11px;opacity:0.8;">发给学生：打开CSP学习助手 → 点 📥 导入课程 → 选这个文件</span>`;
    setTimeout(() => status.remove(), 10000);
    } catch (e) {
      status.textContent = '❌ 生成失败：' + e.message;
      setTimeout(() => status.remove(), 5000);
      console.error('Generate student error:', e);
    }
  }

  _showStudentConfigDialog() {
    return new Promise((resolve) => {
      const providers = { deepseek: 'DeepSeek', siliconflow: '硅基流动（免费）', dashscope: '阿里通义千问', zhipu: '智谱GLM' };
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
      overlay.innerHTML = `<div style="background:#fff;border-radius:12px;padding:24px;width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 8px 0;">🎓 生成学生版</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 16px 0;">已有数据直接复用，仅缺失部分用AI补生成。</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">⚙ 预置AI配置（可选）</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">填了学生直接用，不填则学生自己后期配置</div>
          <label style="font-size:12px;color:#64748b;">供应商</label>
          <select id="stuCfgProvider" style="width:100%;padding:6px;font-size:13px;border:1px solid #e2e8f0;border-radius:4px;margin:4px 0 8px 0;">${Object.entries(providers).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <label style="font-size:12px;color:#64748b;">API Key</label>
          <input id="stuCfgKey" placeholder="sk-..." style="width:100%;padding:6px;font-size:13px;border:1px solid #e2e8f0;border-radius:4px;margin-top:4px;">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="stuCfgCancel" style="padding:8px 20px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;">取消</button>
          <button id="stuCfgOk" style="padding:8px 20px;font-size:13px;font-weight:600;color:#fff;background:#7c3aed;border:none;border-radius:6px;cursor:pointer;">🎓 生成</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);

      overlay.querySelector('#stuCfgCancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
      overlay.querySelector('#stuCfgOk').addEventListener('click', () => {
        const apiKey = document.getElementById('stuCfgKey')?.value?.trim() || '';
        const provider = document.getElementById('stuCfgProvider')?.value || 'deepseek';
        overlay.remove();
        resolve({
          provider,
          apiKey,
          configured: !!apiKey
        });
      });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    });
  }

  async _aiGenerateHints(code, lessonTitle, apiKey) {
    const { endpoint, model } = this._getAIEndpoint();
    const resp = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model, temperature: 0.3, max_tokens: 2048,
        messages: [{ role: 'system', content: HINTS_SYSTEM }, { role: 'user', content: HINTS_USER(lessonTitle, code) }]
      })
    });
    const d = await resp.json();
    const t = d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
    const result = JSON.parse(t.substring(t.indexOf('{'), t.lastIndexOf('}') + 1));
    return this._validateAndFixHints(result);
  }

  // Post-process AI hints to enforce ___ count rules
  _validateAndFixHints(result) {
    if (!result?.hints || result.hints.length < 3) return result;
    const hints = [...result.hints];

    // H1: strip C++ keywords if present
    const cppKW = /\b(int|for|if|cin|cout|return|#include|using|namespace|while|break|continue|else|switch|case|default|endl|main|void|double|float|char|long|bool|unsigned)\b/gi;
    if (cppKW.test(hints[0])) {
      // Replace code-ish lines with a generic text description
      hints[0] = hints[0].replace(/```[\s\S]*?```/g, '').replace(
        /[\w\s<>=!+\-*/%(){}\[\];,"']{30,}/g, '请用中文文字描述解题步骤，不要出现代码。'
      ).trim();
      if (!hints[0]) hints[0] = '请用中文描述解题步骤：第1步理解题意，第2步设计算法，第3步写出代码。';
    }

    // Helper: count ___ in a string
    const countBlanks = s => (s.match(/___/g) || []).length;

    // Helper: auto-blank C++ code — replaces key expressions with ___ until target reached
    const autoBlank = (code, targetBlanks) => {
      let c = code;
      let current = countBlanks(c);
      if (current >= targetBlanks) return c;

      const patterns = [
        { regex: /([+\-*/%]?=\s*)(\w+(\[[^\]]+\])?)(?=\s*[;\n])/, repl: '$1___' },
        { regex: /([<>!=]=?\s*)(\w+(\[[^\]]+\])?)(?=\s*[;)\n])/, repl: '$1___' },
        { regex: /(\(\s*)(\w+)(\s*[,\n)])/, repl: '$1___$3' },
        { regex: /(return\s+)(\w+(\[[^\]]+\])?)(?=\s*[;\n])/, repl: '$1___' },
        { regex: /(cout\s*(?:<<\s*)*)(\w+)(\s*[;\n])/, repl: '$1___$3' },
        { regex: /([+\-*/%]\s*)(\w+(\[[^\]]+\])?)(?=\s*[;\n)])/, repl: '$1___' },
      ];

      // Replace leftmost non-___ match, one at a time
      while (current < targetBlanks) {
        let bestIdx = Infinity, bestMatch = null, replacement = '';
        for (const { regex } of patterns) {
          const g = new RegExp(regex.source, 'g');
          let m;
          while ((m = g.exec(c)) !== null) {
            if (!m[0].includes('___') && m.index < bestIdx) {
              const line = c.substring(c.lastIndexOf('\n', m.index) + 1).trimStart();
              if (line.startsWith('#include') || line.startsWith('using')) continue;
              bestIdx = m.index; bestMatch = m;
              replacement = (m[1] || '') + '___';
              break;
            }
          }
        }
        if (!bestMatch) break;
        c = c.substring(0, bestIdx) + replacement + c.substring(bestIdx + bestMatch[0].length);
        current = countBlanks(c);
      }

      return c;
    };

    // H2: need ≥4 ___
    if (countBlanks(hints[1]) < 4) {
      hints[1] = autoBlank(hints[1], 4);
    }

    // H3: need exactly 2-3 ___
    const h3blanks = countBlanks(hints[2]);
    if (h3blanks < 2) {
      hints[2] = autoBlank(hints[2], 2);
    } else if (h3blanks > 3) {
      // Too many blanks? Replace some with original values (harder, just leave as-is)
      // Or just accept it — 4+ blanks is still better than 0
    }

    return { ...result, hints };
  }

  async _aiGenerateAnimation(code, title, lessonTitle, apiKey) {
    const { endpoint, model } = this._getAIEndpoint();
    const resp = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model, temperature: 0.3, max_tokens: 4096,
        messages: [{ role: 'system', content: ANIMATION_SYSTEM }, { role: 'user', content: ANIMATION_USER(lessonTitle, title, code) }]
      })
    });
    const d = await resp.json();
    return parseStepsJSON(d.choices[0].message.content);
  }

  async _aiGenerateVideo(code, title, thinking, lessonTitle, apiKey) {
    const { endpoint, model } = this._getAIEndpoint();
    const resp = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model, temperature: 0.3, max_tokens: 4096,
        messages: [{ role: 'system', content: VIDEO_SYSTEM }, { role: 'user', content: VIDEO_USER(lessonTitle, title, thinking, code) }]
      })
    });
    const d = await resp.json();
    return parseStepsJSON(d.choices[0].message.content);
  }

  // ============ SINGLE ANIMATION REGENERATION ============
  async _regenerateSingleAnimation(groupKey, idx) {
    const lesson = this._parsedLesson || this.lessons.find(l => l.id === document.getElementById('mgrSaveBtn').dataset.editId);
    if (!lesson) return;
    const problems = lesson[groupKey];
    if (!problems || idx >= problems.length) return;
    const p = problems[idx];
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) return;

    const config = this.getConfig ? this.getConfig() : { apiKey: '' };
    const apiKey = config.apiKey;
    if (!apiKey) { alert('请先配置 AI Key'); return; }

    const card = document.querySelector(`[data-group="${groupKey}"][data-idx="${idx}"][data-field="code"]`)?.closest('.mgr-prob-body');
    const regenBtn = card?.querySelector('.mgr-regen-anim');
    const animSpan = card?.querySelector('.mgr-anim-status');
    if (regenBtn) regenBtn.disabled = true;

    try {
      const steps = await this._aiGenerateAnimation(code, p.title || '', lesson.title || '', apiKey);
      if (steps) {
        p.animationSteps = steps;
        p.animationFile = 'anim_' + (lesson.order || 1) + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';
        if (animSpan) { animSpan.textContent = '已生成 (' + steps.length + '步)'; animSpan.style.color = '#16a34a'; }
        window._showToast?.('✅ 动画已重新生成');
      }
    } catch (e) {
      window._showToast?.('❌ 生成失败: ' + (e.message || ''));
    }
    if (regenBtn) regenBtn.disabled = false;
  }

  // ============ SINGLE VIDEO REGENERATION ============
  async _regenerateSingleVideo(groupKey, idx) {
    const lesson = this._parsedLesson || this.lessons.find(l => l.id === document.getElementById('mgrSaveBtn').dataset.editId);
    if (!lesson) return;
    const problems = lesson[groupKey];
    if (!problems || idx >= problems.length) return;
    const p = problems[idx];
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) return;

    const config = this.getConfig ? this.getConfig() : { apiKey: '' };
    const apiKey = config.apiKey;
    if (!apiKey) { alert('请先配置 AI Key'); return; }

    const card = document.querySelector(`[data-group="${groupKey}"][data-idx="${idx}"][data-field="code"]`)?.closest('.mgr-prob-body');
    const regenBtn = card?.querySelector('.mgr-regen-video');
    const vidSpan = card?.querySelector('.mgr-video-status');
    if (regenBtn) regenBtn.disabled = true;

    try {
      const steps = await this._aiGenerateVideo(code, p.title || '', p.thinking || '', lesson.title || '', apiKey);
      if (steps) {
        p.videoSteps = steps;
        p.videoFile = 'video_' + (lesson.order || 1) + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';
        if (vidSpan) { vidSpan.textContent = '已生成 (' + steps.length + '步)'; vidSpan.style.color = '#16a34a'; }
        window._showToast?.('✅ 讲解视频已重新生成');
      }
    } catch (e) {
      window._showToast?.('❌ 生成失败: ' + (e.message || ''));
    }
    if (regenBtn) regenBtn.disabled = false;
  }

  // ============ FILL MISSING ITEMS ============
  async _fillMissing(groupKey, idx) {
    const lesson = this._parsedLesson || this.lessons.find(l => l.id === document.getElementById('mgrSaveBtn').dataset.editId);
    if (!lesson) return;
    const problems = lesson[groupKey];
    if (!problems || idx >= problems.length) return;
    const p = problems[idx];
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) return;

    const config = this.getConfig ? this.getConfig() : { apiKey: '' };
    const apiKey = config.apiKey;
    if (!apiKey) { alert('请先配置 AI Key'); return; }

    const card = document.querySelector(`[data-group="${groupKey}"][data-idx="${idx}"][data-field="code"]`)?.closest('.mgr-prob-body');
    const btn = card?.querySelector('.mgr-fill-missing');
    if (btn) btn.disabled = true;

    const missing = [];
    if (!p.thinking || !p.progressiveHints || p.progressiveHints.length < 3) missing.push('思路+提示');
    const isHW = (lesson.homework || []).includes(p) || (lesson.extended || []).includes(p);
    if (isHW && !p.animationSteps?.length && !p.animationHTML && !p.animationFile) missing.push('动画');
    if (isHW && !p.videoSteps?.length && !p.videoHTML && !p.videoFile) missing.push('视频');

    try {
      if (!p.thinking || !p.progressiveHints || p.progressiveHints.length < 3) {
        const data = await this._aiGenerateHints(code, lesson.title || '', apiKey);
        if (data) { p.thinking = data.thinking || ''; p.progressiveHints = data.hints || []; }
      }
      if (isHW && !p.animationSteps && !p.animationHTML && !p.animationFile) {
        const steps = await this._aiGenerateAnimation(code, p.title || '', lesson.title || '', apiKey);
        if (steps) { p.animationSteps = steps; p.animationFile = 'anim_' + (lesson.order || 1) + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html'; }
      }
      if (isHW && !p.videoSteps && !p.videoHTML && !p.videoFile) {
        const steps = await this._aiGenerateVideo(code, p.title || '', p.thinking || '', lesson.title || '', apiKey);
        if (steps) { p.videoSteps = steps; p.videoFile = 'video_' + (lesson.order || 1) + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html'; }
      }
      window._showToast?.('✅ 已补生成：' + (missing.length ? missing.join('、') : '无缺失'));
      // Re-render the form
      this._renderStructuredForm(lesson);
    } catch (e) {
      window._showToast?.('❌ 补生成失败: ' + (e.message || ''));
    }
    if (btn) btn.disabled = false;
  }
}
