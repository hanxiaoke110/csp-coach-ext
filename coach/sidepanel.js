/**
 * CSP 教练版 — 独立入口
 */
import { DATA_PATHS } from '../shared/core/config.js';
import { escapeHtml } from '../shared/core/utils.js';
import AIService from '../shared/services/ai-service.js';
import SessionService from '../shared/services/session-service.js';
import CoachLibrary from './components/coach-library.js';
import CoachCourseManager from './components/coach-course-mgr.js';

let aiService, sessionService, library, courseMgr;
let lessons = [], stages = [];

function toast(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}
window._showToast = toast;

async function init() {
  try {
    sessionService = new SessionService();
    await sessionService.init();
    aiService = new AIService(sessionService);
    await aiService.init();

    // Load from storage first, fallback to file (preserves teacher edits across reloads)
    const DATA_VERSION = 4; // bump when lessons.json is updated with new data
    const stored = await chrome.storage.local.get(['csp_lessons', 'csp_stages', 'csp_data_version']);
    const storageVersion = stored.csp_data_version || 0;
    if (stored.csp_lessons?.length && stored.csp_stages?.length && storageVersion >= DATA_VERSION) {
      lessons = stored.csp_lessons;
      stages = stored.csp_stages;
    } else {
      const [lessonsData, stagesData] = await Promise.all([
        fetch(DATA_PATHS.LESSONS).then(r => r.json()),
        fetch(DATA_PATHS.STAGES).then(r => r.json())
      ]);
      stages = stagesData;
      // Flatten {stages: [{lessons: [...]}]} → flat array for filter/search
      lessons = [];
      if (lessonsData.stages) {
        for (const s of lessonsData.stages) {
          for (const l of (s.lessons || [])) {
            lessons.push(l);
          }
        }
      }
      chrome.storage.local.set({ csp_stages: stages, csp_lessons: lessons, csp_data_version: DATA_VERSION });
      if (storageVersion > 0) toast('课程数据已更新到最新版本', 'info');
    }

    library = new CoachLibrary(document.getElementById('libDetail'), {
      stages, lessons, aiService
    });
    library.render();

    courseMgr = new CoachCourseManager({
      onSave: (data) => {
        stages = data.stages;
        lessons = data.lessons;
        library.stages = stages;
        library.lessons = lessons;
        library.render();
        chrome.storage.local.set({ csp_stages: stages, csp_lessons: lessons, csp_data_version: DATA_VERSION }, () => {
          toast('课程数据已保存', 'success');
        });
      },
      getConfig: () => aiService.config
    });

    document.getElementById('courseMgrBtn').addEventListener('click', () => courseMgr.open(stages, lessons));
    // Import zip
    const importFile = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        let raw;
        if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const jsonFile = zip.file('lessons.json');
          if (!jsonFile) throw new Error('压缩包缺少 lessons.json');
          raw = JSON.parse(await jsonFile.async('text'));
        } else {
          raw = JSON.parse(await file.text());
        }

        // Accept flat array, {lessons: [...]}, or {stages: [{lessons: [...]}]}
        let lessonsData;
        if (Array.isArray(raw)) {
          lessonsData = raw;
        } else if (raw.lessons) {
          lessonsData = raw.lessons;
        } else {
          lessonsData = [];
          for (const stage of (raw.stages || [])) {
            for (const l of (stage.lessons || [])) {
              lessonsData.push(l);
            }
          }
        }
        if (!lessonsData.length) throw new Error('未找到课程数据');

        // Save to chrome.storage
        await chrome.storage.local.set({
          csp_lessons: lessonsData,
          csp_stages: stages,
          csp_data_version: Date.now()
        });

        // Reload
        lessons = lessonsData;
        library = new CoachLibrary(document.getElementById('libDetail'), { stages, lessons, aiService });
        library.render();
        toast(`✅ 已导入 ${lessonsData.length} 节课`, 'success');
      } catch (err) {
        toast('❌ 导入失败：' + err.message, 'error');
      }
      importFile.value = '';
    });
    // Export
    document.getElementById('exportBtn').addEventListener('click', async () => {
      try {
        const data = await chrome.storage.local.get(['csp_lessons', 'csp_stages']);
        if (!data.csp_lessons?.length) { toast('没有可导出的课程数据', 'error'); return; }
        const exportData = { stages: data.csp_stages || stages, lessons: data.csp_lessons, exportedAt: new Date().toISOString() };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lessons-coach.json';
        a.click();
        URL.revokeObjectURL(url);
        toast(`✅ 已导出 ${data.csp_lessons.length} 节课（含答案/代码/提示/动画/密码）`, 'success');
      } catch (e) {
        toast('导出失败：' + e.message, 'error');
      }
    });
    // ─── Training Camp Code Generator ───
    const CAMP_SECRET = 'csp-camp-2025';
    function makeCampHash(date) {
      const s = `${date}-${CAMP_SECRET}`;
      let h = 0;
      for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      }
      const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let result = '';
      let v = Math.abs(h);
      for (let i = 0; i < 4; i++) {
        result = chars[v % chars.length] + result;
        v = Math.floor(v / chars.length);
      }
      return result;
    }
    function makeCampRand() {
      const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let r = '';
      for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
      return r;
    }
    function makeCampCode() {
      const d = new Date();
      const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      const hash = makeCampHash(date);
      const rand = makeCampRand();
      return `CAMP-${date}-${hash}-${rand}`;
    }

    const campModal = document.getElementById('campCodeModal');
    document.getElementById('campCodeBtn').addEventListener('click', () => { campModal.style.display = 'flex'; });
    document.getElementById('campCodeClose').addEventListener('click', () => { campModal.style.display = 'none'; });
    campModal.addEventListener('click', (e) => { if (e.target === campModal) campModal.style.display = 'none'; });

    document.getElementById('campGenerate').addEventListener('click', () => {
      const code = makeCampCode();
      document.getElementById('campCodes').innerHTML =
        `<code style="background:#fef9c3;padding:8px 14px;border-radius:8px;font-size:14px;font-family:monospace;font-weight:700;letter-spacing:0.5px">${code}</code>`;
      document.getElementById('campResult').style.display = 'block';
      document.getElementById('campCopyAll').onclick = () => {
        navigator.clipboard.writeText(code);
        toast('已复制集训激活码', 'success');
      };
    });

    document.getElementById('settingsBtn').addEventListener('click', () => { chrome.runtime.openOptionsPage?.(); });

  // Excellence Code Generator
  const SECRET = 'csp-coach-2025';
  function makeExcHash(level, date) {
    // Same algorithm as student RedeemCode.tsx
    const s = `${level}-${date}-${SECRET}`;
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let result = '';
    let v = Math.abs(h);
    for (let i = 0; i < 4; i++) {
      result = chars[v % chars.length] + result;
      v = Math.floor(v / chars.length);
    }
    return result;
  }
  function makeExcCode(level) {
    const d = new Date();
    const date = `${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const hash = makeExcHash(level, date);
    const rand = makeExcRand();
    return `EXC-${level}-${date}-${hash}-${rand}`;
  }
  function makeExcRand() {
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let r = '';
    for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
  }

  const excModal = document.getElementById('excCodeModal');
  document.getElementById('excCodeBtn').addEventListener('click', () => { excModal.style.display = 'flex'; });
  document.getElementById('excCodeClose').addEventListener('click', () => { excModal.style.display = 'none'; });
  excModal.addEventListener('click', (e) => { if (e.target === excModal) excModal.style.display = 'none'; });

  document.getElementById('excGenerate').addEventListener('click', () => {
    const level = document.getElementById('excLevel').value;
    const count = parseInt(document.getElementById('excCount').value) || 1;
    const codes = [];
    for (let i = 0; i < count; i++) codes.push(makeExcCode(level));

    const levelNames = { '1': '🥇 一等奖', '2': '🥈 二等奖', '3': '🥉 三等奖' };
    document.getElementById('excResultTitle').textContent = levelNames[level] + ' 新生成的优秀码';
    const codesDiv = document.getElementById('excCodes');
    codesDiv.innerHTML = codes.map(c =>
      `<code style="background:#f1f5f9;padding:6px 10px;border-radius:6px;font-size:13px;font-family:monospace">${c}</code>`
    ).join('');
    document.getElementById('excResult').style.display = 'block';

    document.getElementById('excCopyAll').onclick = () => {
      navigator.clipboard.writeText(codes.join('\n'));
      toast('已复制 ' + codes.length + ' 个优秀码', 'success');
    };
  });
    if (!aiService.isConfigured()) {
      toast('AI 未配置，Debug 功能不可用。点击右上角「AI 服务设置」配置。', 'info');
    }
  } catch (e) {
    document.getElementById('libDetail').innerHTML =
      `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
  }
}

init();
