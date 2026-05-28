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
  return d.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
}

let done = 0, total = 0;
for (const l of lessons) {
  for (const p of [...(l.review || []), ...(l.inClassCodes || []), ...(l.inClassQuiz || []), ...(l.homework || []), ...(l.extended || [])]) {
    if (p.difficulty === 'lecture') continue;
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) continue;
    total++;
    if (p.thinking && (p.progressiveHints || []).length >= 3) { done++; continue; }

    try {
      const context = `题目：${p.title || ''}\n描述：${(p.description || '').substring(0, 500)}\n输入：${(p.inputFormat || '')}\n输出：${(p.outputFormat || '')}\n参考代码：\n${code.substring(0, 1200)}`;
      const result = await callAI(
        `你是面向中小学生的C++信奥教学专家。根据题目和参考代码，生成解题思路和三级渐进提示。

【thinking 解题思路】
用小学生能懂的语言，2-3句话解释算法思路。纯中文，不出现任何代码。

【hints 三级提示 — 面向中小学生信奥竞赛，严格遵守】

第1级：纯中文文字描述。
绝对不能出现 int、for、if、cin、cout、return、#include、using namespace 等任何代码关键字。
用分步骤的中文描述算法做法，就像老师在跟学生讲解"先做什么、再做什么、最后做什么"。
格式示例：
第一步，先读入一个整数，把它存起来。
第二步，用读到的这个数，按公式计算结果。
第三步，把算出来的结果输出。

第2级：代码框架 + 2-3处___留空。
给出代码的整体骨架，头文件、主函数、输入输出都写全。只在最核心的算法行留2-3个___让学生填。关键位置用//写注释解释为什么。4空格缩进。

第3级：接近完整代码 + 1-2处___留空。
代码基本完整，只留最关键的1-2个表达式为___。学生完成这1-2个空就接近完整答案了。有详细注释。4空格缩进。

【铁律】
- 面向中小学生，代码规范、清晰、有注释
- 第1级绝对不能出现代码，纯中文
- 第2级是框架，第3级近完整，逐级递进
- ___表示学生需要填的位置
- 必须有换行和4空格缩进
- 输出纯JSON，不要markdown包裹`,
        context
      );
      const data = JSON.parse(result.substring(result.indexOf('{'), result.lastIndexOf('}') + 1));
      p.thinking = data.thinking || '';
      // Normalize hints: extract content if AI returns objects instead of strings
      p.progressiveHints = (data.hints || []).map(h => {
        if (typeof h === 'string') return h;
        if (h && typeof h === 'object') return h.content || h.text || h.code || '';
        return String(h || '');
      });
      done++;
    } catch (e) { }

    if (total % 10 === 0) {
      raw.stages.forEach(stage => { stage.lessons = stage.lessons.map(l => lessons.find(fl => fl.id === l.id) || l); });
      writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));
      process.stdout.write('.');
    }
  }
}

raw.stages.forEach(stage => { stage.lessons = stage.lessons.map(l => lessons.find(fl => fl.id === l.id) || l); });
      writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));
console.log('\nGenerated:', done, '/', total);
