import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
const raw = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));
const lessons = [];
for (const stage of (raw.stages || [])) {
  for (const l of (stage.lessons || [])) {
    lessons.push(l);
  }
}

const tasks = [];
lessons.forEach(l => {
  [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])].forEach(p => {
    if (!p.title || (p.commonMistakes || []).length >= 2) return;
    if (p.difficulty === 'lecture') return;
    const code = p.code || p.answerCode || '';
    if (code.length > 30) tasks.push({ title: p.title, code: code.substring(0, 800), lesson: l.id });
  });
});
console.log('Need mistakes:', tasks.length);

async function genMistake(title, code) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature: 0, max_tokens: 300,
      messages: [{ role: 'system', content: '根据C++代码列出2-3个学生常见错误。输出JSON数组：[{"mistake":"错误","fix":"修正"}]。只输出JSON。' },
      { role: 'user', content: `题目：${title}\n代码：\n${code}` }]
    })
  });
  try {
    const d = await r.json();
    const t = d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
    return JSON.parse(t.substring(t.indexOf('['), t.lastIndexOf(']') + 1));
  } catch (e) { return []; }
}

let done = 0;
for (const task of tasks) {
  try {
    const mistakes = await genMistake(task.title, task.code);
    if (mistakes.length) {
      for (const l of lessons) {
        if (l.id !== task.lesson) continue;
        const p = [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])].find(x => x.title === task.title);
        if (p) { p.commonMistakes = mistakes; done++; break; }
      }
    }
  } catch (e) { }
  if (done % 10 === 0) process.stdout.write('.');
}

raw.stages.forEach(stage => { stage.lessons = stage.lessons.map(l => lessons.find(fl => fl.id === l.id) || l); });
writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));
let withM = 0, total = 0;
lessons.forEach(l => { [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])].forEach(p => { if (!p.title) return; total++; if (p.commonMistakes?.length) withM++; }); });
console.log('\nGenerated:', done, '| With mistakes:', withM, '/', total);
