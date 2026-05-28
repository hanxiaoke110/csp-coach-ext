/**
 * AI 动画生成 — 生成 animationSteps JSON 数据，播放时用 renderTemplate 渲染
 * 用法: DEEPSEEK_API_KEY=sk-xxx node scripts/gen-animations.js
 */

import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const raw = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));
const lessons = [];
for (const stage of (raw.stages || [])) {
  for (const l of (stage.lessons || [])) {
    lessons.push(l);
  }
}

async function callAI(system, user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content;
}

function parseSteps(text) {
  // Extract JSON array from AI response
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < 0) return null;
  try {
    const arr = JSON.parse(text.substring(start, end + 1));
    if (!Array.isArray(arr) || arr.length < 2) return null;
    // Validate each step has html and narration
    return arr.filter(s => s.html && s.narration);
  } catch (e) { return null; }
}

let done = 0, total = 0;

for (const l of lessons) {
  for (const p of [...(l.homework || []), ...(l.extended || [])]) {
    if (p.difficulty === 'lecture') continue;
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) continue;
    total++;

    // Skip if already has good animationSteps
    if (p.animationSteps?.length >= 2) { done++; continue; }

    try {
      const result = await callAI(
        `你是C++信奥教学可视化专家。根据题目代码，生成JSON格式的动画步骤数组。

【输出格式 — 纯JSON】
[{
  "html": "<h2>第一步：理解题意</h2><p>用中文描述这步做什么，用彩色方块/数字/箭头，适合小学生看的可视化排版</p>",
  "narration": "第一步，理解题意。我们要输入n个数，然后找出其中最大的那个。"
}, {
  "html": "<h2>第二步：算法思路</h2><p>...</p>",
  "narration": "第二步，..."
}, ...]

【规则】
- 3-6步，不能少于2步
- html：用中文描述 + 可视化元素（<span style='color:...'>等内联样式），活泼配色
- narration：小学生能懂的语音讲解，2-3句话，纯中文
- 绝对不能出现C++代码（#include, int main, cin, cout等）
- 不讲语法，讲算法逻辑
- 输出纯JSON数组，不要markdown包裹`,

        '题目：' + p.title + '\n参考代码（理解逻辑用，不要展示）：\n' + code.substring(0, 1000)
      );

      const steps = parseSteps(result);
      if (steps) {
        p.animationSteps = steps;
        // Keep animationFile for backward compat (used by existing code paths)
        const fname = 'anim_' + l.order + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';
        p.animationFile = fname;
        done++;
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (e) { process.stdout.write('x'); }

    if (done % 10 === 0) {
      raw.stages.forEach(stage => { stage.lessons = stage.lessons.map(l => lessons.find(fl => fl.id === l.id) || l); });
      writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));
    }
  }
}

raw.stages.forEach(stage => { stage.lessons = stage.lessons.map(l => lessons.find(fl => fl.id === l.id) || l); });
writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));

console.log('\nGenerated:', done, '/', total);
