import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const SYSTEM = `你是C++教学助手。根据参考答案，为小学生生成三级递进提示。

【三级提示规则 — 必须严格遵守】

第1级（纯引导，绝对不能出现任何C++代码）：
- 只能用中文文字描述每步做什么
- 绝对不能出现 int、for、if、cin、cout、return、#include 等任何代码关键字
- 格式：用 "第1步：..." "第2步：..." 的文字描述

第2级（代码框架，关键逻辑必须用___留空）：
- 给出带有完整结构的C++代码
- 但核心算法行必须用 ___ 留空（至少2-3处）
- 只能留空关键计算/判断逻辑，变量声明、输入输出、基本结构可以完整

第3级（接近完整，只留1-2个___）：
- 给出几乎完整的代码
- 只把最关键的1-2个表达式或条件用 ___ 留空
- 其余全部完整

输出JSON：{"hints":["第1级内容","第2级内容","第3级内容"]}
只输出JSON。`;

async function callAI(code) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.1, max_tokens: 2048, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: '参考答案：\n' + code.substring(0, 1500) }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  const text = d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s >= 0 && e > s) {
    const obj = JSON.parse(text.substring(s, e + 1));
    if (obj.hints && Array.isArray(obj.hints) && obj.hints.length === 3) return obj.hints;
  }
  throw new Error('Failed to parse: ' + text.substring(0, 100));
}

function hasCodeLines(hint) {
  if (!hint) return false;
  const lines = hint.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  return lines.some(l => /\b(int|for|while|if|cout|cin|return|sort|#include|using namespace|main\s*\(|string|char|double|float|long long|struct|class|bool|void|const)\b/.test(l));
}

function hasBlanks(hint) { return hint && hint.includes('___'); }

function isHintBad(hints, level) {
  if (!hints || hints.length < 3) return true;
  const h = hints[level];
  if (!h) return true;
  if (level === 0) return hasCodeLines(h);
  return (!hasBlanks(h) && hasCodeLines(h));
}

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

// Collect bad problems
const queue = [];
lessons.forEach(lesson => {
  [...(lesson.inClassCodes || []), ...(lesson.homework || []), ...(lesson.extended || [])].forEach(p => {
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) return;
    const hints = p.progressiveHints || [];
    if (isHintBad(hints, 0) || isHintBad(hints, 1) || isHintBad(hints, 2)) {
      queue.push({ lesson, problem: p, code, title: p.title || p.id });
    }
  });
});

console.log(`Total problems to fix: ${queue.length}`);

let fixed = 0, failed = 0;
for (let i = 0; i < queue.length; i++) {
  const { lesson, problem, code, title } = queue[i];
  try {
    const newHints = await callAI(code);
    problem.progressiveHints = newHints;

    // Verify
    const ok = !isHintBad(newHints, 0) && !isHintBad(newHints, 1) && !isHintBad(newHints, 2);
    if (ok) {
      fixed++;
      process.stdout.write(`\r✅ [${i + 1}/${queue.length}] P${lesson.order} ${title.substring(0, 20)}`);
    } else {
      failed++;
      process.stdout.write(`\r⚠️ [${i + 1}/${queue.length}] P${lesson.order} ${title.substring(0, 20)} (still has issues)`);
    }
  } catch (e) {
    failed++;
    process.stdout.write(`\r❌ [${i + 1}/${queue.length}] P${lesson.order} ${title.substring(0, 20)}: ${e.message}`);
  }

  // Save every 10 problems
  if ((i + 1) % 10 === 0) {
    writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
  }

  // Rate limit
  await new Promise(r => setTimeout(r, 300));
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\n\nDone! Fixed: ${fixed}, Failed: ${failed}`);
