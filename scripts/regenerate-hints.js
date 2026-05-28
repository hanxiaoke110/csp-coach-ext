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
  return d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
}

async function genHints(code) {
  const prompt = `你是C++教学助手。根据代码生成三级递进提示：
- 第1级(20%代码)：只保留框架骨架(#include, int main(){}), 其余全用注释引导。例如：
  "// 定义变量n存储个数，sum存储总和\n// 读入数字个数\n// 循环读入n个数\n  // 读入每个数\n  // 累加到sum\n// 输出总和"
- 第2级(60%代码)：保留60%代码+注释，关键逻辑处用___填空。例如保留for循环结构但条件留空
- 第3级(80%代码)：保留80%代码+注释，只留1-2个关键变量或表达式填空(用___表示)

输出JSON：{"thinking":"解题思路(3-4步小学生语言)","hints":["第1级内容","第2级内容","第3级内容"]}。
代码中的每行都要有注释引导。只输出JSON。`;

  const result = await callAI(prompt, '代码：\n' + code.substring(0, 1500));
  const s = result.indexOf('{'), e = result.lastIndexOf('}');
  if (s < 0) return null;
  try { return JSON.parse(result.substring(s, e + 1)); } catch (x) { return null; }
}

let done = 0, total = 0;

for (const l of lessons) {
  for (const p of [...(l.inClassCodes || []), ...(l.homework || []), ...(l.extended || [])]) {
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) continue;
    total++;

    try {
      const data = await genHints(code);
      if (data) {
        p.thinking = data.thinking || p.thinking || '';
        if (data.hints && data.hints.length >= 3) { p.progressiveHints = data.hints; done++; }
      }
    } catch (e) { }

    if (total % 10 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write('.');
    }
  }
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log('\nRegenerated:', done, '/', total);
