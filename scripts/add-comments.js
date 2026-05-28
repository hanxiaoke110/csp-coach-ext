import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

async function callAI(system, user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content;
}

function cleanCode(text) {
  let t = text.replace(/```cpp\s*\n?/gi, '').replace(/```\s*\n?/gi, '').replace(/\n?```\s*$/gi, '');
  t = t.trim();
  if (t.includes('#include') || t.includes('int main') || t.includes('cout')) return t;
  return null;
}

let doneCode = 0, doneHint = 0, total = 0;

for (const l of lessons) {
  for (const p of [...(l.inClassCodes || []), ...(l.homework || []), ...(l.extended || [])]) {
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 10) continue;

    // 1. Add comments to code
    if (!code.includes('//')) {
      total++;
      try {
        const result = await callAI(
          '你是C++教学助手。为下面C++代码的每行添加//注释，用小学生能理解的语言解释代码作用。不要修改代码逻辑，只添加注释。保留原有缩进。直接输出完整代码，不要markdown包裹。',
          '代码：\n' + code.substring(0, 2000)
        );
        const cleaned = cleanCode(result);
        if (cleaned && cleaned.includes('//') && cleaned.length > code.length * 0.5) {
          if (p.code !== undefined) p.code = cleaned;
          else p.answerCode = cleaned;
          doneCode++;
          process.stdout.write('C');
        } else { process.stdout.write('x'); }
      } catch (e) { process.stdout.write('E'); }
    }

    // 2. Add comments to hint L2 and L3
    const hints = p.progressiveHints || [];
    for (let idx = 1; idx <= 2; idx++) {
      if (hints[idx] && hints[idx].length > 10 && !hints[idx].includes('//')) {
        total++;
        try {
          const result = await callAI(
            `你是C++教学助手。这是渐进式提示第${idx+1}级（代码${idx===1?'60':'80'}%可见，其余用___填空）。为代码每行添加//注释解释作用。保留所有___填空和代码结构。直接输出完整代码，不要markdown包裹。`,
            '提示代码：\n' + hints[idx].substring(0, 2000)
          );
          const cleaned = cleanCode(result);
          if (cleaned && cleaned.includes('//') && cleaned.length > hints[idx].length * 0.3) {
            hints[idx] = cleaned;
            doneHint++;
            process.stdout.write('H');
          } else { process.stdout.write('x'); }
        } catch (e) { process.stdout.write('E'); }
      }
    }

    if (total > 0 && total % 20 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` [${doneCode}C ${doneHint}H] `);
    }
  }
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nDone! Codes: ${doneCode}, Hints: ${doneHint}`);
