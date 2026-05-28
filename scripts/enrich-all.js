/**
 * 为所有题目的代码添加行内注释，并生成三级渐进提示（带注释）。
 * L1: 纯注释引导（无代码）
 * L2: 代码框架 + 逐行注释 + 5-8 个关键___留空
 * L3: 近完整代码 + 逐行注释 + 2-3 个___留空
 *
 * 用法: DEEPSEEK_API_KEY=sk-xxx node scripts/enrich-all.js
 */
import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

async function callAI(system, user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.2,
      max_tokens: 4096,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices[0].message.content;
}

function extractJSON(text) {
  // Strip markdown
  let t = text.replace(/```json\s*|```/g, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.substring(start, end + 1);
  try { return JSON.parse(t); } catch (e) { return null; }
}

function cleanCode(text) {
  let t = text.replace(/```cpp\s*\n?/gi, '').replace(/```\s*\n?/gi, '').replace(/\n?```\s*$/gi, '');
  t = t.trim();
  if (t.includes('#include') || t.includes('int main') || t.includes('cout') || t.includes('using namespace')) return t;
  return null;
}

const SYSTEM = `你是C++信奥教学专家。为每道题输出JSON：

{
  "commentedCode": "逐行注释的完整代码（每行后加//解释，小学生语言）",
  "hints": [
    "第1级：纯注释引导，无代码，用//注释描述算法3-5个核心步骤",
    "第2级：代码框架+每行注释，5-8个关键位置用___留空（如循环条件、判断条件、关键变量）",
    "第3级：近完整代码+每行注释，仅2-3个最易错位置用___留空"
  ]
}

规则：
- 注释语言：小学生能理解的简洁中文
- 代码风格：保留原有缩进和结构
- 第1级只输出//注释行，不包含任何代码
- 第2级___数量和位置要覆盖核心逻辑
- 第3级___只在最容易被忽略的地方（如边界条件）
- 如果原始代码已包含完整注释，commentedCode可留空""`;

let doneComments = 0, doneHints = 0, total = 0, skipped = 0;

for (const l of lessons) {
  for (const p of [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])]) {
    if (p.difficulty === 'lecture') continue;
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) continue;
    total++;

    // Check if already enriched with comments AND 3-level hints
    const hasComments = code.includes('//');
    const hints = p.progressiveHints || [];
    const hasThreeLevelHints = hints.length >= 3 &&
      hints.every(h => h && h.length > 10);

    // Skip if fully enriched
    if (hasComments && hasThreeLevelHints) {
      skipped++;
      if (skipped % 50 === 0) process.stdout.write(`(${skipped} skip) `);
      continue;
    }

    // Need to enrich
    try {
      const title = p.title || l.title || '';
      const result = await callAI(SYSTEM, `题目：${title}\n原始代码：\n${code.substring(0, 2000)}`);

      const data = extractJSON(result);
      if (!data) { process.stdout.write('J'); continue; }

      // Update commented code
      if (data.commentedCode) {
        const cleaned = cleanCode(data.commentedCode);
        if (cleaned && cleaned.includes('//') && cleaned.length > code.length * 0.4) {
          if (p.code !== undefined) p.code = cleaned;
          else p.answerCode = cleaned;
          doneComments++;
          process.stdout.write('C');
        }
      }

      // Update hints
      if (data.hints && Array.isArray(data.hints) && data.hints.length >= 3) {
        const validHints = data.hints.filter(h => h && h.length > 10);
        if (validHints.length >= 3) {
          p.progressiveHints = validHints.slice(0, 3);
          doneHints++;
          process.stdout.write('H');
        }
      }

    } catch (e) {
      process.stdout.write('E');
    }

    // Save periodically
    if (total % 20 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` [${doneComments}C ${doneHints}H/${total}] `);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nDone! Comments: ${doneComments}, Hints: ${doneHints}, Total: ${total}, Skipped: ${skipped}`);
