import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

const SYSTEM = `你是C++教学助手。输出三级渐进提示的JSON。

提示标准：
- 第1级(20%代码)：只保留框架骨架(#include, using, int main(){})，其余全用//注释引导。示例：
  "// 包含输入输出头文件\n// 使用标准命名空间\n\nint main()\n{\n    // 定义变量n\n    // 读入n\n    // 计算并输出n+28\n    // 计算并输出n+30\n    return 0;\n}"
  注意：框架内只能有注释，不能有任何实际代码语句！

- 第2级(60%代码)：保留60%代码+注释，关键逻辑处用___填空（至少2个___）。例如保留for/if结构但条件或变量留空。

- 第3级(75%代码)：保留75%代码+注释，只留1-2个关键变量或表达式填空(用___表示)。绝对不能是完整代码！必须至少有1个___！

输出JSON：{"thinking":"解题思路(小学生语言,3-4步)","hints":["第1级","第2级","第3级"]}。只输出JSON。`;

async function callAI(user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 4096, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
}

function needsFixing(p) {
  const hints = p.progressiveHints || [];
  if (hints.length < 3) return true;
  // L3 must have ___
  if (!hints[2].includes('___')) return true;
  // L2 must have ___
  if (!hints[1].includes('___')) return true;
  // L1 should not have actual code (cout/cin/for/if etc — only comments in body)
  const l1body = hints[0].substring(hints[0].indexOf('{') + 1, hints[0].lastIndexOf('}')).trim();
  if (/^\s*(cout|cin|for|if|while|return\s+[^0])/m.test(l1body)) return true;
  return false;
}

let done = 0, total = 0;
for (const l of lessons) {
  for (const p of [...(l.inClassCodes || []), ...(l.homework || []), ...(l.extended || [])]) {
    const code = (p.code || p.answerCode || '').trim();
    if (code.length < 10) continue;
    if (!needsFixing(p)) continue;
    total++;

    try {
      const result = await callAI(`课程：${l.title}\n题目：${p.title}\n代码：\n${code.substring(0, 1500)}`);
      const data = JSON.parse(result.substring(result.indexOf('{'), result.lastIndexOf('}') + 1));
      if (data.hints && data.hints.length >= 3 && data.hints[2].includes('___')) {
        p.thinking = data.thinking || p.thinking || '';
        p.progressiveHints = data.hints;
        done++; process.stdout.write('.');
      } else { process.stdout.write('x'); }
    } catch (e) { process.stdout.write('E'); }

    if (total % 20 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` ${done}/${total} `);
    }
    if (total % 5 === 0) process.stdout.write(' ');
  }
}
writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nFixed: ${done}/${total}`);
