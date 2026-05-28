import { readFileSync, writeFileSync } from 'fs';
import { MISTAKES_SYSTEM, HINTS_SYSTEM, HINTS_USER, CODE_COMMENT_SYSTEM, VIDEO_SYSTEM, VIDEO_USER, extractHTML } from '../shared/services/gen-prompts.js';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

async function callAI(system, user, maxTokens = 2048) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content;
}

function cleanCode(text) {
  let t = text.replace(/```cpp\s*\n?/gi, '').replace(/```\s*\n?/gi, '').replace(/\n?```\s*$/gi, '').trim();
  if (t.includes('#include') || t.includes('int main')) return t;
  return null;
}

function getTaughtConcepts(lessonOrder) {
  const taught = [];
  for (const l of lessons) {
    if (l.order > lessonOrder) break;
    taught.push(`第${l.order}课《${l.title}》：${(l.knowledgePoints || []).map(k => k.name).join('、') || '基础C++语法'}`);
  }
  return taught.join('\n');
}

let totalOps = 0;

// Step 1: Fill missing codes
for (const l of lessons) {
  for (const p of [...(l.inClassCodes || []), ...(l.homework || []), ...(l.extended || [])]) {
    const code = (p.code || p.answerCode || '').trim();
    if (code.length >= 10) continue;
    if (!p.description || p.description.length < 10) continue;

    const concepts = getTaughtConcepts(l.order);
    try {
      const result = await callAI(CODE_COMMENT_SYSTEM,
        `已学知识：\n${concepts}\n\n题目：${p.title}\n描述：${(p.description || '').substring(0, 1000)}`, 4096);
      const cleaned = cleanCode(result);
      if (cleaned && cleaned.length > 20) {
        p.code = cleaned; p.answerCode = cleaned;
        totalOps++; process.stdout.write('C');
      } else { process.stdout.write('x'); }
    } catch (e) { process.stdout.write('E'); }
  }
}
writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nStep 1: codes fixed`);

// Step 2: Fill missing thinking + hints
for (const l of lessons) {
  for (const p of [...(l.inClassCodes || []), ...(l.homework || []), ...(l.extended || [])]) {
    const code = (p.code || p.answerCode || '').trim();
    if (code.length < 10) continue;
    if ((p.thinking || '').length > 5 && (p.progressiveHints || []).length >= 3) continue;
    try {
      const result = await callAI(HINTS_SYSTEM, HINTS_USER(l.title, code));
      const t = result.replace(/```json\s*|```/g, '').trim();
      const data = JSON.parse(t.substring(t.indexOf('{'), t.lastIndexOf('}') + 1));
      p.thinking = data.thinking || '';
      p.progressiveHints = data.hints || [];
      totalOps++; process.stdout.write('H');
    } catch (e) { process.stdout.write('E'); }
  }
}
writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nStep 2: thinking+hints fixed`);

// Step 3: Fill missing mistakes (batch 5 per call)
let batch = [];
const processBatch = async () => {
  if (!batch.length) return;
  const items = batch; batch = [];
  try {
    const codesBlock = items.map((x, i) => `[${i}] ${x.p.title}\n代码：\n${x.code.substring(0, 400)}`).join('\n\n');
    const result = await callAI(MISTAKES_SYSTEM, codesBlock.substring(0, 8000), 2048);
    const t = result.replace(/```json\s*|```/g, '').trim();
    const arr = JSON.parse(t.substring(t.indexOf('['), t.lastIndexOf(']') + 1));
    items.forEach((x, i) => { if (arr[i]?.length) { x.p.commonMistakes = arr[i]; totalOps++; } });
    process.stdout.write('.');
  } catch (e) { process.stdout.write('x'); }
};
for (const l of lessons) {
  for (const p of [...(l.homework || []), ...(l.extended || [])]) {
    const code = (p.code || p.answerCode || '').trim();
    if (code.length < 10) continue;
    if ((p.commonMistakes || []).length > 0) continue;
    batch.push({ p, code });
    if (batch.length >= 5) await processBatch();
  }
}
await processBatch();
writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nStep 3: mistakes fixed`);

// Step 4: Fill missing videos
let vidDone = 0, vidTotal = 0;
for (const l of lessons) {
  for (const p of [...(l.homework || []), ...(l.extended || [])]) {
    const code = (p.code || p.answerCode || '').trim();
    if (code.length < 10) continue;
    vidTotal++;
    if (p.videoHTML) { vidDone++; continue; }
    try {
      const result = await callAI(VIDEO_SYSTEM, VIDEO_USER(l.title, p.title, p.thinking || '', code), 8192);
      const html = extractHTML(result);
      if (html) {
        p.videoHTML = html;
        p.videoFile = 'video_' + l.order + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';
        vidDone++; process.stdout.write('V');
      } else { process.stdout.write('x'); }
    } catch (e) { process.stdout.write('E'); }
    if (vidDone % 10 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` ${vidDone}/${vidTotal} `);
    }
  }
}
writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nStep 4: videos ${vidDone}/${vidTotal}`);
console.log(`\n=== Done ===`);
