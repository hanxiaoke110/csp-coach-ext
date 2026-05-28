/**
 * CSP Options — 简洁 AI 设置
 * DeepSeek / 硅基流动 / 阿里百炼 / 智谱
 */
import Storage from '../shared/core/storage.js';
import { AI_PROVIDERS, AI_MODELS, API_ENDPOINTS, DEFAULT_CONFIG, TTS_VOICES } from '../shared/core/config.js';

const $ = (id) => document.getElementById(id);
let currentProvider = DEFAULT_CONFIG.aiProvider;

// 提供商切换
document.querySelectorAll('input[name="provider"]').forEach(radio => {
  radio.addEventListener('change', () => {
    currentProvider = radio.value;
    document.querySelectorAll('.provider-card').forEach(c =>
      c.classList.toggle('selected', c.querySelector('input').checked));
    updateModels();
  });
});

function updateModels() {
  const sel = $('modelSelect');
  const card = $('modelCard');
  const models = AI_MODELS[currentProvider] || {};
  const keys = Object.keys(models);
  if (keys.length <= 1) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  sel.innerHTML = keys.map(k => `<option value="${k}">${models[k].name}</option>`).join('');
}

$('toggleKey').addEventListener('click', () => {
  const isPass = $('apiKey').type === 'password';
  $('apiKey').type = isPass ? 'text' : 'password';
  $('toggleKey').textContent = isPass ? '🙈 隐藏' : '👁 显示';
});

async function load() {
  const saved = await Storage.get('config');
  if (saved) {
    currentProvider = saved.aiProvider || DEFAULT_CONFIG.aiProvider;
    $('apiKey').value = saved.apiKey || '';
    document.querySelectorAll('input[name="provider"]').forEach(r => {
      if (r.value === currentProvider) { r.checked = true; r.closest('.provider-card').classList.add('selected'); }
    });
    if (saved.model) setTimeout(() => { if ($('modelSelect')) $('modelSelect').value = saved.model; }, 0);
    if (saved.ttsVoice && $('ttsVoice')) $('ttsVoice').value = saved.ttsVoice;
    }
  updateModels();
}

$('testBtn').addEventListener('click', async () => {
  const key = $('apiKey').value.trim();
  if (!key) { showStatus('请先输入 API Key', 'error'); return; }
  const endpoint = API_ENDPOINTS[currentProvider];
  const model = Object.keys(AI_MODELS[currentProvider] || {})[0] || '';

  $('testBtn').disabled = true; $('testBtn').textContent = '测试中...';
  showStatus('正在连接...', 'info');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
    });
    if (res.ok) showStatus(' 连接成功！AI 功能已就绪', 'success');
    else {
      const t = await res.text();
      let msg = `HTTP ${res.status}`;
      try { msg = JSON.parse(t).error?.message || msg; } catch (e) {}
      showStatus(` 连接失败：${msg}`, 'error');
    }
  } catch (e) {
    showStatus(` 网络错误：${e.message}`, 'error');
  } finally {
    $('testBtn').disabled = false; $('testBtn').textContent = '🔗 测试连接';
  }
});

$('saveBtn').addEventListener('click', async () => {
  const config = {
    aiProvider: currentProvider,
    apiKey: $('apiKey').value.trim(),
    model: $('modelSelect')?.value || Object.keys(AI_MODELS[currentProvider] || {})[0] || '',
    ttsVoice: $('ttsVoice')?.value || DEFAULT_CONFIG.ttsVoice,
  };
  await Storage.set('config', config);
  toast(' 设置已保存');
});

function showStatus(msg, type) {
  const el = $('status');
  el.className = `status ${type} show`;
  el.textContent = msg;
}

function toast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2000);
}

load();
