/**
 * 批量生成 511 个动画 JSON（keyCode + mistakes + 7 stages）
 * 用法: DEEPSEEK_API_KEY=sk-xxx node scripts/gen-batch-animations.js
 */
import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

const SYSTEM = `你是C++信奥教学动画设计师。为题目生成动画数据，输出纯JSON：

{
  "keyCode": [
    {"line": "关键代码行1", "explain": "解释（小学生语言，10字内）"},
    {"line": "关键代码行2", ...}
  ],
  "mistakes": [
    {"wrong": "错误写法", "right": "正确写法", "explain": "为什么容易错"}
  ],
  "stages": [
    {"narration": "阶段0情境引入配音文本(25秒)"},
    {"narration": "阶段1条件拆解配音文本(20秒)"},
    {"narration": "阶段2算法演示配音文本(80秒，用具体数字逐步演示)"},
    {"narration": "阶段3运行结果配音文本(15秒)"},
    {"narration": "阶段4代码映射配音文本(40秒，介绍关键代码)"},
    {"narration": "阶段5易错提醒配音文本(20秒)"},
    {"narration": "阶段6拓展思考配音文本(15秒)"}
  ]
}

规则：
- keyCode: 5行关键代码，不展示#include/main/using namespace等样板代码
- mistakes: 2-3个最常见的错误
- 配音: 温柔老师口吻，小学生能听懂，用具体数字举例
- 只输出JSON，不要markdown包裹`;

async function callAI(user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature: 0.3, max_tokens: 4096,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices[0].message.content;
}

function extractJSON(text) {
  let t = text.replace(/```json\s*|```/g, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.substring(s, e + 1);
  try { return JSON.parse(t); } catch (_) { return null; }
}

let done = 0, skipped = 0, failed = 0, total = 0;

for (const l of lessons) {
  for (const p of [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])]) {
    if (p.difficulty === 'lecture') continue;
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) continue;
    total++;

    // Skip if already has animation
    if (p.animation?.keyCode?.length && p.animation?.stages?.length) {
      skipped++;
      if (skipped % 50 === 0) process.stdout.write(`(${skipped}s)`);
      continue;
    }

    const title = p.title || l.title || '';
    const thinking = p.thinking || '';

    try {
      const userPrompt = `题目：${title}\n解题思路：${thinking}\n代码：\n${code.substring(0, 2000)}`;
      const result = await callAI(userPrompt);
      const data = extractJSON(result);

      if (!data) { failed++; process.stdout.write('J'); continue; }

      // Build animation object
      const anim = {
        problemId: 'P' + l.order + '-' + (title.match(/\d{4,}/)?.[0] || '0'),
        keyCode: (data.keyCode || []).slice(0, 5),
        mistakes: (data.mistakes || []).slice(0, 3),
        stages: (data.stages || []).slice(0, 7).map((s, i) => ({
          id: i,
          name: ['情境引入','条件拆解','算法演示','运行结果','代码映射','易错提醒','拓展思考'][i] || '阶段'+i,
          type: ['intro','conditions','algorithm','result','codeMapping','pitfall','extension'][i] || 'intro',
          audioFile: 'stage-' + i + '.mp3',
          narration: s.narration || '',
          html: '',
        })),
      };

      // Fix stage html
      anim.stages.forEach(s => {
        if (s.type === 'intro') s.html = `<div style="text-align:center"><div class="big-icon">🎯</div><div class="intro-title">${title}</div><div style="font-size:16px;color:#475569;margin-top:16px;line-height:1.8;max-width:500px;margin:16px auto 0">${s.narration}</div></div>`;
        else if (s.type === 'conditions') s.html = `<div class="info-card" style="font-size:16px;line-height:2">${s.narration}</div>`;
        else if (s.type === 'algorithm') s.html = `<div class="info-card" style="font-size:15px;line-height:1.8;text-align:left">🎬 <b>算法演示</b><br><br>${s.narration}</div>`;
        else if (s.type === 'result') s.html = `<div style="text-align:center"><div style="font-size:48px">✅</div><div class="info-card">${s.narration}</div></div>`;
        else if (s.type === 'extension') s.html = `<div class="think-card">🤔<br><br>${s.narration}</div>`;
      });

      p.animation = anim;
      done++;
      process.stdout.write('.');
    } catch (e) {
      failed++;
      process.stdout.write('E');
    }

    // Save every 20
    if (total % 20 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` [${done}/${total}] `);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nDone! Generated: ${done}, Skipped: ${skipped}, Failed: ${failed}, Total: ${total}`);
