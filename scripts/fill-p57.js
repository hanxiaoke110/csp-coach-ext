import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));
const p57 = lessons.find(l => l.order === 57);
const problems = [...(p57.homework || []), ...(p57.extended || [])];

async function callAI(system, user, maxTokens = 1024) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.1, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content;
}

function parseJSON(text) {
  const t = text.replace(/```json\s*|```/g, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) return JSON.parse(t.substring(s, e + 1));
  const s2 = t.indexOf('['), e2 = t.lastIndexOf(']');
  if (s2 >= 0 && e2 > s2) return JSON.parse(t.substring(s2, e2 + 1));
  return JSON.parse(t);
}

let count = 0;
for (const p of problems) {
  const code = p.code || p.answerCode || '';
  if (!code || code.length < 30) continue;

  console.log('Processing: ' + p.title);

  // Generate thinking + hints
  try {
    const hintsResult = await callAI(
      '你是C++教学助手。输出JSON：{"thinking":"解题思路(3-4步小学生语言)","hints":["第1级纯注释引导无代码","第2级代码框架关键部分___留空","第3级接近完整只留1-2个___填空"]}。只输出JSON。',
      '课程：P57-差分\n代码：\n' + code.substring(0, 1500)
    );
    const parsed = parseJSON(hintsResult);
    p.thinking = parsed.thinking || '';
    p.progressiveHints = Array.isArray(parsed.hints) ? parsed.hints : (parsed.progressiveHints || []);
    console.log('  thinking: ' + (p.thinking ? 'OK' : 'FAIL'));
    console.log('  hints: ' + (p.progressiveHints?.length || 0));
  } catch (e) { console.error('  hints error:', e.message); }

  // Generate common mistakes
  try {
    const mistakesResult = await callAI(
      '根据C++代码列出2-3个常见错误。输出JSON：[{"mistake":"错","fix":"改"}]。只输出JSON。',
      code.substring(0, 800),
      300
    );
    p.commonMistakes = parseJSON(mistakesResult);
    console.log('  mistakes: ' + (Array.isArray(p.commonMistakes) ? p.commonMistakes.length : 0));
  } catch (e) { console.error('  mistakes error:', e.message); }

  count++;
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log('\nGenerated for ' + count + ' problems. Saved.');
