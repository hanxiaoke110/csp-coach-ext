// Template Engine — animation player
//
// EXTENSION POINTS (set before template loads, or override at runtime):
//   window.ANIMATION_TTS(text, voice, rate, onDone)
//     — custom TTS provider. text=string, voice=string, rate=float, onDone=callback.
//     — must call onDone() when audio finishes or fails.
//   window.ANIMATION_VOICES = [{id, name}]
//     — custom voice list. If set, overrides system voice dropdown.
//
// To upgrade audio later (Edge/Azure/Cloud), just implement ANIMATION_TTS.

(function() {
var hash = window.location.hash.slice(1);
var parts = hash.includes('-') ? hash.split('-') : ['61', '16920'];
var lessonOrder = parts[0], qid = parts[1];

// DOM refs
var stageEl = document.getElementById('stageArea');
var progressFill = document.getElementById('progressFill');
var stageIndicator = document.getElementById('stageIndicator');
var btnPrev = document.getElementById('btnPrev');
var btnNext = document.getElementById('btnNext');
var btnPlay = document.getElementById('btnPlay');
var btnReset = document.getElementById('btnReset');

var PROBLEM = null;
var TOTAL = 0;
var currentStage = -1;
var autoPlaying = false;
var audioDone = true;      // true when current stage audio finished
var activeAudio = null;    // current Audio element (MP3 or Blob)
var timers = [];           // all pending setTimeout IDs

function setTimer(fn, ms) {
  var id = setTimeout(function() { clearTimer(id); fn(); }, ms);
  timers.push(id);
  return id;
}
function clearTimer(id) {
  var i = timers.indexOf(id);
  if (i >= 0) timers.splice(i, 1);
  clearTimeout(id);
}
function clearAllTimers() {
  timers.forEach(function(id) { clearTimeout(id); });
  timers = [];
}

// Load data
function loadData(cb) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    cb(new Error('非扩展环境')); return;
  }
  chrome.storage.local.get('csp_lessons', function(result) {
    if (!result.csp_lessons) { cb(new Error('无课程数据，请先打开侧边栏')); return; }
    var data = result.csp_lessons;
    var lesson = data.find(function(l) { return l.order === parseInt(lessonOrder); });
    if (!lesson) { cb(new Error('找不到第' + lessonOrder + '课')); return; }
    var all = [].concat(lesson.inClassCodes || [], lesson.homework || [], lesson.extended || []);
    var problem = all.find(function(p) { return (p.title || '').indexOf(qid) >= 0; });
    if (!problem) problem = all.find(function(p) { return p.animation; });
    if (!problem || !problem.animation) { cb(new Error('该题无动画数据')); return; }
    var anim = problem.animation;
    cb(null, {
      title: problem.title,
      lessonTitle: lesson.title,
      problemId: anim.problemId || (lessonOrder + '-' + qid),
      keyCode: anim.keyCode || [],
      mistakes: anim.mistakes || [],
      stages: anim.stages || [],
      audioBase: 'audio/' + (anim.problemId || (lessonOrder + '-' + qid)) + '/',
    });
  });
}

function initEngine() {
  TOTAL = PROBLEM.stages.length;
  if (TOTAL === 0) { showStatus('无动画阶段数据', false); return; }
  document.getElementById('titleDisplay').textContent = PROBLEM.title;
  document.getElementById('stageBadge').textContent = PROBLEM.lessonTitle;

  var nav = document.getElementById('stageNav');
  PROBLEM.stages.forEach(function(s, i) {
    var dot = document.createElement('div');
    dot.className = 'stage-dot';
    dot.innerHTML = (i+1) + '<span class="dot-label">' + s.name + '</span>';
    dot.addEventListener('click', (function(idx) { return function() {
      if (idx <= currentStage + 1 && idx !== currentStage) navigateTo(idx);
    };})(i));
    dot.id = 'stageDot' + i;
    nav.appendChild(dot);
    if (i < TOTAL - 1) {
      var conn = document.createElement('div');
      conn.className = 'stage-connector';
      conn.id = 'stageConn' + i;
      nav.appendChild(conn);
    }
  });
  navigateTo(0);
}

// Stage content rendering
function renderStageContent(stage) {
  var html = stage.html || '<div class="info-card">' + (stage.narration || '') + '</div>';
  if (stage.type === 'codeMapping' && PROBLEM.keyCode.length) {
    var lines = PROBLEM.keyCode.map(function(k) {
      return '<div style="margin:8px 0;padding:10px 14px;background:#1e293b;border-radius:8px;font-family:monospace;font-size:15px">' +
        '<div style="color:#fbbf24;line-height:1.6">' + k.line.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
        '<div style="color:#94a3b8;font-size:13px;margin-top:4px">// ' + k.explain + '</div></div>';
    }).join('');
    html = '<div style="text-align:center;width:100%"><div style="font-size:18px;font-weight:700;color:#6366f1;margin-bottom:16px">💻 关键代码（5行核心逻辑）</div>' + lines + '</div>';
  }
  if (stage.type === 'pitfall' && PROBLEM.mistakes.length) {
    var items = PROBLEM.mistakes.map(function(m) {
      return '<div style="margin:10px 0;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;text-align:left">' +
        '<div style="color:#94a3b8;font-size:13px;margin-bottom:4px">' + m.explain + '</div>' +
        '<div style="font-family:monospace;font-size:14px;color:#dc2626;margin:4px 0">❌ ' + m.wrong.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
        '<div style="font-family:monospace;font-size:14px;color:#16a34a">✅ ' + m.right.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div></div>';
    }).join('');
    html = '<div style="text-align:center;width:100%"><div style="font-size:20px;font-weight:700;color:#dc2626;margin-bottom:16px">⚠️ 常见错误</div>' + items + '</div>';
  }
  return html;
}

// ============ TTS PROVIDER (pluggable — swap for Edge/Azure/etc) ============
// To upgrade: replace speakWithTTS() implementation below
// Signature: speakWithTTS(stage, onDone) — must call onDone() when done

// ============ AUDIO: unified state machine ============

// Stop ALL audio and timers. Safe to call anytime.
function stopAll() {
  clearAllTimers();
  if (activeAudio) { activeAudio.pause(); activeAudio = null; }
  speechSynthesis.cancel();
}

// Play audio for a stage. Tries MP3 first, falls back to browser TTS.
// Calls onDone() exactly once when audio finishes or fails.
function playAudio(idx, onDone) {
  stopAll();
  audioDone = false;
  var stage = PROBLEM.stages[idx];
  var finished = false;

  function done() {
    if (finished) return;
    finished = true;
    audioDone = true;
    if (onDone) onDone();
  }

  // Try 1: pre-generated MP3
  var mp3 = new Audio(PROBLEM.audioBase + 'stage-' + idx + '.mp3');
  var mp3Started = false;

  mp3.onended = done;
  mp3.onerror = function() {
    if (mp3Started) { done(); return; }
    if (finished) return;
    finished = true;
    // Fall through to TTS
    speakWithTTS(stage, done);
  };
  mp3.oncanplaythrough = function() {
    if (mp3Started || finished) return;
    mp3Started = true;
    activeAudio = mp3;
    mp3.play().catch(function() { if (!finished) { finished = true; speakWithTTS(stage, done); } });
  };
  // 1.5s timeout: if MP3 didn't load, use TTS
  setTimer(function() {
    if (!mp3Started && !finished) { finished = true; mp3 = null; speakWithTTS(stage, done); }
  }, 1500);
}

var ttsVoice = null;  // null = use default

function getTTSVoices() {
  return speechSynthesis.getVoices().filter(function(v) { return v.lang.startsWith('zh'); });
}

function initVoiceSelector() {
  var sel = document.getElementById('voiceSelect');
  function populate() {
    // Custom voices from extension point
    if (window.ANIMATION_VOICES) {
      sel.innerHTML = window.ANIMATION_VOICES.map(function(v) {
        return '<option value="' + v.id + '">' + v.name + '</option>';
      }).join('');
      sel.style.display = '';
      ttsVoice = window.ANIMATION_VOICES[0] || null;
      return;
    }
    var voices = getTTSVoices();
    if (!voices.length) return;
    sel.innerHTML = voices.map(function(v) {
      return '<option value="' + v.name + '">' + v.name + '</option>';
    }).join('');
    sel.style.display = '';
    // Auto-pick 美嘉 (Mei-Jia) as default if available, otherwise first Chinese voice
    var preferred = voices.find(function(v) { return v.name.indexOf('Mei') >= 0 || v.name.indexOf('美嘉') >= 0 || v.name.indexOf('Tingting') >= 0 || v.name.indexOf('Huihui') >= 0; });
    if (preferred) { sel.value = preferred.name; ttsVoice = preferred; }
  }
  populate();
  speechSynthesis.onvoiceschanged = populate;
  sel.addEventListener('change', function() {
    ttsVoice = getTTSVoices().find(function(v) { return v.name === sel.value; }) || null;
  });
}

function speakWithTTS(stage, onDone) {
  // Check for custom TTS provider first
  if (window.ANIMATION_TTS) {
    window.ANIMATION_TTS(stage.narration, (ttsVoice || {}).name || 'default', 0.9, onDone);
    return;
  }
  if (!stage.narration) { audioDone = true; if (onDone) onDone(); return; }
  var u = new SpeechSynthesisUtterance(stage.narration);
  u.lang = 'zh-CN';
  u.rate = 0.9;
  if (ttsVoice) u.voice = ttsVoice;
  var started = false;
  u.onstart = function() { started = true; clearTimeout(safetyId); };
  u.onend = function() { clearTimeout(safetyId); if (onDone) onDone(); };
  u.onerror = function() {
    clearTimeout(safetyId);
    if (!started && ttsVoice) {
      ttsVoice = null;
      speakWithTTS(stage, onDone);
      return;
    }
    if (onDone) onDone();
  };
  speechSynthesis.speak(u);
  // Safety: if selected voice doesn't start within 3s, retry with default
  var safetyId = setTimeout(function() {
    if (!started && ttsVoice) {
      speechSynthesis.cancel();
      ttsVoice = null;
      speakWithTTS(stage, onDone);
    }
  }, 3000);
  timers.push(safetyId);
}

// ============ NAVIGATION ============

function navigateTo(idx) {
  if (idx < 0 || idx >= TOTAL) return;
  stopAll();
  audioDone = false;  // new stage = not yet listened

  var stage = PROBLEM.stages[idx];
  currentStage = idx;

  stageEl.style.opacity = '0';
  setTimer(function() {
    stageEl.innerHTML = '<div class="stage-content">' + renderStageContent(stage) + '</div>';
    stageEl.style.transition = 'opacity 0.3s';
    stageEl.style.opacity = '1';
  }, 150);

  updateUI();

  // In auto-play mode, play and advance
  if (autoPlaying) {
    playAudio(idx, function() {
      if (!autoPlaying) return;
      setTimer(function() {
        if (currentStage < TOTAL - 1) navigateTo(currentStage + 1);
        else stopAuto();
      }, 600);
    });
  }
}

function updateUI() {
  progressFill.style.width = ((currentStage + 1) / TOTAL * 100) + '%';
  stageIndicator.textContent = (currentStage + 1) + '/' + TOTAL;
  PROBLEM.stages.forEach(function(s, i) {
    var dot = document.getElementById('stageDot' + i);
    if (!dot) return;
    dot.classList.remove('active', 'done');
    if (i < currentStage) dot.classList.add('done');
    if (i === currentStage) dot.classList.add('active');
  });
  for (var i = 0; i < TOTAL - 1; i++) {
    var conn = document.getElementById('stageConn' + i);
    if (conn) conn.classList.toggle('done', i < currentStage);
  }
  btnPrev.disabled = currentStage === 0;
  btnNext.disabled = currentStage >= TOTAL - 1;
}

function stopAuto() {
  autoPlaying = false;
  btnPlay.textContent = '▶ 播放';
}

// ============ BUTTONS ============

// Next stage: stop everything, go forward
btnNext.addEventListener('click', function() {
  if (currentStage < TOTAL - 1) {
    stopAuto();
    navigateTo(currentStage + 1);
  }
});

// Previous stage: stop everything, go back
btnPrev.addEventListener('click', function() {
  if (currentStage > 0) {
    stopAuto();
    navigateTo(currentStage - 1);
  }
});

// Play/Pause toggle
btnPlay.addEventListener('click', function() {
  if (autoPlaying) {
    // Pause
    stopAll();
    stopAuto();
    return;
  }
  // Play
  autoPlaying = true;
  btnPlay.textContent = '⏸ 暂停';
  if (currentStage >= TOTAL - 1 && audioDone) {
    // Last stage already done? Replay from start
    navigateTo(0);
  } else if (audioDone && currentStage < TOTAL - 1) {
    // Current done? Move to next
    navigateTo(currentStage + 1);
  } else {
    // Haven't listened yet — play current
    playAudio(currentStage, function() {
      if (!autoPlaying) return;
      setTimer(function() {
        if (currentStage < TOTAL - 1) navigateTo(currentStage + 1);
        else stopAuto();
      }, 600);
    });
  }
});

// Reset: stop everything, go to stage 0
btnReset.addEventListener('click', function() {
  stopAll();
  stopAuto();
  currentStage = -1;
  navigateTo(0);
});

// ============ START ============
function showStatus(msg, ok) {
  stageEl.innerHTML = '<div class="loading" style="color:' + (ok ? '#16a34a' : '#ef4444') + '">' + msg + '</div>';
}
showStatus('步骤1: Hash=' + hash + ' Order=' + lessonOrder + ' QID=' + qid, true);
// Debug: check if chrome.storage exists
if (typeof chrome === 'undefined') { showStatus('❌ chrome API 不可用，非扩展环境', false); }
else if (!chrome.storage) { showStatus('❌ chrome.storage 不可用', false); }
else {
  showStatus('步骤2: 读取chrome.storage...', true);
  loadData(function(err, data) {
    if (err) { showStatus('❌ ' + err.message, false); return; }
    PROBLEM = data;
    showStatus('步骤3: 数据加载成功, ' + data.stages.length + ' stages', true);
    initEngine();
    initVoiceSelector();
  });
}

})();
