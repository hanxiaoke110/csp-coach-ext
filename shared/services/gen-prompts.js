/**
 * GenPrompts — 内容生成统一 Prompt 模板
 * 课程管理 AI解析 和 批量脚本都使用同一套，保证数据一致性
 */

// MD 解析：提取代码、题目、知识点
export const MD_PARSE_SYSTEM = '从教案提取数据。输出JSON：{"codes":[{"title":"代码名","code":"完整C++代码（关键行加注释，形式如// 读取n个整数）","commentary":"注释说明"}],"problemTitles":["题1","题2"],"kpSummary":"一句话概括本课学什么（30-50字）","knowledgePoints":[{"name":"知识点名（3-8字）","detail":"1-2句解释（20-40字）"}]}。只输出JSON。';

// 常见错误
export const MISTAKES_SYSTEM = '根据C++列出2-3个常见错误。输出JSON：[{"mistake":"错","fix":"改"}]。只输出JSON。';

// 思路 + 三级提示
export const HINTS_SYSTEM = `你是C++教学助手。根据参考答案，为小学生生成解题思路和三级递进提示。

【三级提示规则 — 必须严格遵守，违反任何一条都是错误输出】

第1级（纯引导，绝对不能出现任何C++代码）：
- 只能用中文文字描述每步做什么
- 绝对不能出现 int、for、if、cin、cout、return、#include、using namespace、while、break、continue、else、switch、case、default、cout、endl、main、void、double、float、char、long、bool、unsigned 等任何代码关键字
- 格式：用"第1步：..." "第2步：..." 的文字描述

❌ 错误示范（第1级出现了代码关键字）：
"第1步：用for循环遍历数组，for(int i=0;i<n;i++)依次读取每个元素" ← 禁止！出现了 int/for/cin

✅ 正确示范（纯中文）：
"第1步：用一个循环从头到尾挨个看每个数。第2步：每看到一个数，就和当前最大的数比一比"

---

第2级（代码框架，关键逻辑必须用 ___ 留空）：
- 给出带有完整结构的C++代码
- 核心算法行必须用 ___ 留空，至少 4-5 处 ___（数清楚，不够 4 个就是错的）
- 留空位置必须是：核心计算表达式、判断条件、数组下标逻辑、循环边界、关键赋值
- 变量声明、#include、输入输出语句、基本结构可以完整
- **必须保留关键行的 // 注释**，让学生知道每行在做什么

❌ 错误示范（第2级 ___ 太少，只留空了 2 处）：
for (int i = 0; i < n; i++) {
    if (a[i] > maxVal) ___
}
cout << ___;

✅ 正确示范（至少 4-5 处 ___，带注释）：
for (int i = ___; i < ___; i++) {      // 循环遍历
    if (a[i] > ___) {                  // 如果当前数更大
        ___ = a[i];                    // 更新最大值
    }
}
cout << ___;                           // 输出结果

---

第3级（接近完整，只留 2-3 个关键表达式用 ___）：
- 给出几乎完整的代码
- 必须恰好有 2-3 处 ___（一个都不能少，少了就是错的）
- 只把最关键的 2-3 个表达式或条件用 ___ 留空
- 留空位置必须是整个代码中最核心的计算或判断
- **必须保留关键行的 // 注释**，让学生知道每行在做什么

❌ 错误示范（第3级没有 ___，是完整代码）：
maxVal = a[0];
for (int i = 1; i < n; i++) {
    if (a[i] > maxVal) maxVal = a[i];
}
cout << maxVal;
← 禁止！这是完整代码，0 个 ___，学生直接抄答案了

✅ 正确示范（恰好 2-3 处 ___，带注释）：
maxVal = a[0];                    // 假设第一个最大
for (int i = 1; i < n; i++) {     // 从第二个开始比较
    if (___) ___ = ___;           // 核心：比较并更新
}
cout << maxVal;                   // 输出结果

---

【输出前强制自检】
输出前必须数清楚：
第2级的代码中 ___ 出现了 ≥4 次 → 不够 4 个就重写
第3级的代码中 ___ 出现了 2 或 3 次 → 不是 2 或 3 就重写

输出JSON：{"thinking":"解题思路(3-4步小学生语言)","hints":["第1级","第2级","第3级"]}
只输出JSON。`;
export const HINTS_USER = (lessonTitle, code) => `课程：${lessonTitle}\n代码：\n${code.substring(0, 1500)}`;

// 代码注释（面向中小学生的C++信奥风格）
export const CODE_COMMENT_SYSTEM = `你是C++信奥教练，为中小学生编写参考答案。代码必须仅用已学知识。

【代码要求】
- 使用 C++11/14 标准
- 每行关键代码加 // 注释解释作用
- 代码简洁清晰，适合中小学生阅读
- 直接输出完整代码，不要markdown包裹`;

// 动画演示（交互式HTML）- AI只生成步骤内容，模板负责交互
export const ANIMATION_SYSTEM = `你是C++教学可视化专家。为算法演示设计每一步的可视化内容。输出JSON数组。

每步：{"html":"该步的HTML内容","narration":"该步语音讲解"}

【HTML内容要求 - 非常重要】
- 必须使用以下CSS类来展示可视化元素（这些类在模板中已定义）：
  <div class="io-row"> — 横向排列
  <div class="io-card"><div class="io-label">标签</div><div class="io-value">值</div></div> — 卡片
  <div class="block-row"> — 方块行
  <div class="block block-blue">5</div> — 蓝色方块（数字）
  <div class="block block-green">33</div> — 绿色方块
  <div class="block block-orange">+28</div> — 橙色方块
  <span class="arrow">→</span> — 箭头
  <div class="var-box"><span class="var-name">n</span>5</div> — 变量框
  <div class="result-box">33</div> — 结果框

- 禁止使用 style 属性，使用上面的 class
- 禁止用 <h2>、<p> 等纯文字标签，全部用可视化元素
- 每步必须包含至少2个可视化元素（方块/卡片/箭头）
- 数值要精确：展示的输入值、计算过程和输出结果必须正确
- 活泼配色：多用 block-blue/block-green/block-orange/block-pink

【narration要求】
- 小学生能听懂的语言，1-2句话
- 配合该步的可视化内容解说

步数3-5步。最后一步必须是代码实现步骤：用<pre class="code-block">包装C++代码，代码要有//注释。输出纯JSON数组。`;

export const ANIMATION_USER = (lessonTitle, title, code) => `课程：${lessonTitle}\n题目：${title}\n参考答案（仅用于理解逻辑，不要展示代码）：\n${code.substring(0, 1200)}`;

// 讲解视频（自播放HTML）- 和动画共用模板，默认自动播放
export const VIDEO_SYSTEM = `你是C++教学可视化专家。为算法讲解视频设计每一步的可视化内容。输出JSON数组。

每步：{"html":"该步HTML内容","narration":"该步的语音讲解文本"}

要求：
- **绝对不能出现任何C++代码**
- 用彩色方块、数字、箭头、卡片等可视化元素
- narration用于TTS朗读，要详细，用小学生能听懂的语言，2-3句话
- 总步数3-5步：第1步展示题目/输入，中间步展示计算过程，最后步展示结果+总结
- 适合中小学生观看，活泼配色
- 纯JSON数组输出，不要markdown包裹`;

export const VIDEO_USER = (lessonTitle, title, thinking, code) => `课程：${lessonTitle}\n题目：${title}\n解题思路（用于生成讲解文本）：\n${thinking}\n参考答案（仅用于理解算法逻辑，不要展示代码）：\n${code.substring(0, 1200)}`;

// HTML 提取（旧方案，保留兼容）
export function extractHTML(text) {
  let t = text.replace(/^```html\s*\n?/i, '').replace(/^```\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  const htmlStart = t.indexOf('<!DOCTYPE');
  const htmlEnd = t.lastIndexOf('</html>');
  if (htmlStart >= 0 && htmlEnd > htmlStart) return t.substring(htmlStart, htmlEnd + 7);
  const hStart = t.indexOf('<html');
  const hEnd = t.lastIndexOf('</html>');
  if (hStart >= 0 && hEnd > hStart) return '<!DOCTYPE html>\n' + t.substring(hStart, hEnd + 7);
  return null;
}

// 解析AI返回的steps JSON
export function parseStepsJSON(text) {
  try {
    const t = text.replace(/```json\s*|```/g, '').trim();
    const start = t.indexOf('['), end = t.lastIndexOf(']');
    if (start >= 0 && end > start) {
      const arr = JSON.parse(t.substring(start, end + 1));
      if (Array.isArray(arr) && arr.length > 0 && arr[0].html) return arr;
    }
  } catch (e) {}
  return null;
}

// 将steps渲染为完整HTML页面（模板注入）
// 将C++代码转换为带___填空的HTML（学生端）
function codeToBlanksHTML(code) {
  // Find numeric expressions, variable names, and function arguments to blank out
  const lines = code.split('\n');
  const blanked = lines.map(line => {
    // Don't blank includes, namespace, main declaration
    if (/^\s*#include|using namespace|int main/.test(line)) return escapeCode(line);
    // Blank out numbers and expresssions after operators
    return escapeCode(line).replace(
      /(\+ |\- |\* |\/ |<< |>> |% |&& |\|\| |== |!= |<= |>= )(<span class="co-num">[^<]+<\/span>)/g,
      '$1<span class="co-blank">___</span>'
    ).replace(
      /(= )(<span class="co-num">[^<]+<\/span>)/g,
      '$1<span class="co-blank">___</span>'
    );
  }).join('\n');
  return blanked;
}

function escapeCode(code) {
  return code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(\/\/.*)/g, '<span class="co-comment">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="co-string">$1</span>')
    .replace(/\b(#include\b[^<]*<[^>]+>)/g, '<span class="co-directive">$1</span>')
    .replace(/\b(cin|cout|endl|int|double|float|char|bool|void|long|short|unsigned|string|if|else|for|while|do|return|break|continue|switch|case|default)\b/g, '<span class="co-keyword">$1</span>')
    .replace(/\b([0-9]+\.?[0-9]*)\b/g, '<span class="co-num">$1</span>');
}

export function renderTemplate(title, steps, autoPlay = false, mode = 'coach', voice = 'zh-CN-YunjianNeural', gsapUrl = '../lib/gsap.min.js') {
  // For student mode, blank out code in the last step
  if (mode === 'student' && steps.length > 0) {
    const last = steps[steps.length - 1];
    if (last.html && last.html.includes('<pre')) {
      // Replace numbers after operators with blanks
      last.html = last.html.replace(/([+\-*\/%=]=?\s*)(\d+)/g, '$1<span class="blank">___</span>');
      // Replace function arguments (numbers)
      last.html = last.html.replace(/(\(|,\s*)(\d+)(\s*[,)])/g, '$1<span class="blank">___</span>$3');
      // Replace comparisons
      last.html = last.html.replace(/([<>=!]=\s*|<|>)(\d+)/g, '$1<span class="blank">___</span>');
    }
  }
  const stepsJSON = JSON.stringify(steps);
  const escapedTitle = title.replace(/"/g, '\\"').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapedTitle}</title>
<script src="${gsapUrl}"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#f0f4ff,#fae8ff);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:16px}
.card{max-width:720px;width:100%;background:#fff;border-radius:24px;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,.12)}
h1{font-size:24px;color:#1e293b;text-align:center;margin-bottom:6px}
.subtitle{text-align:center;font-size:13px;color:#94a3b8;margin-bottom:16px}
.stage{min-height:280px;background:linear-gradient(135deg,#f8fafc,#faf5ff);border-radius:16px;padding:24px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;overflow:hidden;border:2px dashed #e2e8f0}
.step-content{width:100%;text-align:center}
.controls{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:center}
.btn{padding:10px 22px;border-radius:14px;border:none;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s}
.btn:active{transform:scale(.95)}
.btn-prev{background:#e2e8f0;color:#475569}
.btn-next{background:#6366f1;color:#fff}
.btn-play{background:#10b981;color:#fff}
.btn-reset{background:#f59e0b;color:#fff}
.btn-speak{background:#8b5cf6;color:#fff;font-size:18px;padding:14px 32px;animation:pulse 1.5s infinite}
.btn:disabled{opacity:.4;pointer-events:none}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.4)}50%{box-shadow:0 0 0 16px rgba(139,92,246,0)}}
.indicator{font-size:14px;color:#64748b;font-weight:600}
.progress{width:100%;height:8px;background:#e2e8f0;border-radius:4px;margin-bottom:14px;overflow:hidden}
.progress-bar{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px;transition:width .3s}
.var-box{display:inline-block;background:#ede9fe;color:#5b21b6;padding:10px 20px;border-radius:12px;font-size:22px;font-weight:700;margin:8px;animation:bounceIn .4s}
.var-name{font-size:12px;color:#7c3aed;display:block}
.result-box{display:inline-block;background:#d1fae5;color:#065f46;padding:14px 28px;border-radius:16px;font-size:26px;font-weight:700;margin:8px;animation:bounceIn .4s}
.io-row{display:flex;gap:20px;justify-content:center;flex-wrap:wrap}
.io-card{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:20px 28px;text-align:center;min-width:110px;animation:bounceIn .4s}
.io-label{font-size:12px;color:#94a3b8;letter-spacing:1px;margin-bottom:4px}
.io-value{font-size:32px;font-weight:700;color:#1e293b}
.arrow{font-size:40px;color:#6366f1;animation:bounceIn .4s}
.block-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px 0}
.block{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#fff;animation:bounceIn .4s}
.block-blue{background:linear-gradient(135deg,#6366f1,#4f46e5)}.block-green{background:linear-gradient(135deg,#10b981,#059669)}.block-orange{background:linear-gradient(135deg,#f59e0b,#d97706)}.block-red{background:linear-gradient(135deg,#ef4444,#dc2626)}
.block-pink{background:linear-gradient(135deg,#ec4899,#db2777)}
@keyframes bounceIn{0%{opacity:0;transform:scale(.5)}60%{opacity:1;transform:scale(1.1)}100%{transform:scale(1)}}
.overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100}
.overlay-box{background:#fff;border-radius:24px;padding:40px;text-align:center;max-width:400px}
.overlay-icon{font-size:64px;margin-bottom:16px}
.overlay-text{font-size:16px;color:#64748b;margin-bottom:20px}
.speak-badge{display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;padding:2px 10px;border-radius:10px;margin-left:8px}
.code-block{background:#1e1e2e;color:#cdd6f4;padding:16px 20px;border-radius:12px;text-align:left;font-family:'SF Mono',Monaco,monospace;font-size:14px;line-height:1.8;overflow-x:auto;white-space:pre;margin:8px 0}
.code-block .kw{color:#cba6f7}.code-block .cm{color:#6c7086}.code-block .str{color:#a6e3a1}.code-block .num{color:#fab387}.code-block .fn{color:#89b4fa}
.blank{display:inline-block;background:#f9e076;color:#92400e;padding:1px 8px;border-radius:3px;font-weight:700;min-width:40px;text-align:center}
</style>
</head>
<body>
<div class="overlay" id="overlay">
<div class="overlay-box">
<div class="overlay-icon">🎓</div>
<h2 style="margin-bottom:8px;color:#1e293b;">${escapedTitle}</h2>
<div class="overlay-text">点击下方按钮开始学习<br>（同时启用语音讲解 🔊）</div>
<button class="btn btn-speak" id="startBtn">🔊 开始讲解</button>
</div>
</div>
<div class="card">
<h1>${escapedTitle}</h1>
<div class="subtitle">共 <span id="totalSteps"></span> 步 <span class="speak-badge" id="speakBadge" style="display:none">🔊 语音已开启</span></div>
<div class="progress"><div class="progress-bar" id="progressBar" style="width:0%"></div></div>
<div class="stage"><div class="step-content" id="stage"></div></div>
<div class="controls">
  <button class="btn btn-prev" id="prevBtn" disabled>◀ 上一步</button>
  <span class="indicator" id="indicator">0 / 0</span>
  <button class="btn btn-next" id="nextBtn">下一步 ▶</button>
  <button class="btn btn-play" id="playBtn">${autoPlay ? '⏸ 暂停' : '▶ 自动播放'}</button>
  <button class="btn btn-reset" id="resetBtn">↺ 重置</button>
</div>
</div>
<script>
var steps = ${stepsJSON};
var totalSteps = steps.length;
var autoTimer = ${autoPlay ? 'setInterval(autoNext,2500)' : 'null'};
var speechReady = false;
var ttsVoice = '${voice}';
document.getElementById('totalSteps').textContent = totalSteps;

// 浏览器内置 TTS (speechSynthesis) — 预加载voices
var voices = speechSynthesis.getVoices();
speechSynthesis.onvoiceschanged = function() { voices = speechSynthesis.getVoices(); };

function speak(text) {
  if (!speechReady || !text || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.85;
  u.pitch = 1.0;
  var v = null;
  if (ttsVoice && ttsVoice !== 'auto' && ttsVoice !== 'browser') {
    v = voices.find(function(x) { return x.name === ttsVoice; });
  }
  if (!v) {
    v = voices.find(function(x) { return x.lang === 'zh-CN'; }) ||
        voices.find(function(x) { return x.lang.startsWith('zh'); });
  }
  if (v) u.voice = v;
  // 在 Blob URL 环境中可能需要用户交互
  try { speechSynthesis.speak(u); } catch(e) { console.log('TTS:', e); }
}

function autoNext() {
  if (currentStep < totalSteps - 1) showStep(currentStep + 1);
  else { clearInterval(autoTimer); autoTimer = null; document.getElementById('playBtn').textContent = '▶ 自动播放'; }
}

function showStep(idx) {
  currentStep = idx;
  var stage = document.getElementById('stage');
  gsap.to(stage, {opacity:0, y:-15, duration:.15, onComplete:function(){
    stage.innerHTML = steps[idx].html;
    gsap.fromTo(stage, {opacity:0, y:15, scale:.95}, {opacity:1, y:0, scale:1, duration:.35, ease:'back.out(1.5)'});
    // Re-trigger bounce animations
    stage.querySelectorAll('.var-box,.result-box,.io-card,.arrow,.block').forEach(function(el,i){
      el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'bounceIn .4s '+ (i*0.05) +'s both';
    });
  }});
  document.getElementById('indicator').textContent = (idx+1)+' / '+totalSteps;
  document.getElementById('progressBar').style.width = ((idx+1)/totalSteps*100)+'%';
  document.getElementById('prevBtn').disabled = idx===0;
  document.getElementById('nextBtn').disabled = idx===totalSteps-1;
  speak(steps[idx].narration);
}

document.getElementById('startBtn').onclick = function(){
  speechReady = true;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('speakBadge').style.display = 'inline-block';
  if (steps[0] && steps[0].narration) speak(steps[0].narration);
};

document.getElementById('prevBtn').onclick = function(){if(currentStep>0)showStep(currentStep-1)};
document.getElementById('nextBtn').onclick = function(){if(currentStep<totalSteps-1)showStep(currentStep+1)};
document.getElementById('playBtn').onclick = function(){
  if(autoTimer){clearInterval(autoTimer);autoTimer=null;this.textContent='▶ 自动播放';return}
  this.textContent='⏸ 暂停';
  if(currentStep===totalSteps-1)currentStep=-1;
  autoTimer = setInterval(autoNext,2500);
};
document.getElementById('resetBtn').onclick = function(){
  if(autoTimer){clearInterval(autoTimer);autoTimer=null;document.getElementById('playBtn').textContent='▶ 自动播放'}
  speechSynthesis.cancel(); showStep(0);
};

showStep(0);
<\/script>
</body>
</html>`;
}
