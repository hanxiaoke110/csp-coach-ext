/**
 * AI 代码生成 — 为缺少代码的题目生成参考代码
 * 按课次约束可用语法，符合中小学生信奥规范
 * 用法: DEEPSEEK_API_KEY=sk-xxx node scripts/gen-code.js
 */

import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

// ============================================================
// 课次 → 可用C++特性约束
// ============================================================
const CURRICULUM = [
  { maxP: 7,  label: 'C++基础',     allowed: '只能使用: cin/cout, int/long long/float/double, 算术运算(+-*/%), 变量声明与赋值。' },
  { maxP: 12, label: '分支结构',     allowed: '只能使用: P7及之前的全部 + if/else, switch, 关系运算符(> < >= <= == !=), 逻辑运算符(&& || !)。' },
  { maxP: 21, label: '循环结构',     allowed: '只能使用: P12及之前的全部 + for循环, while循环, 嵌套循环, break, continue。' },
  { maxP: 25, label: '一维数组',     allowed: '只能使用: P21及之前的全部 + 一维数组(声明/遍历/下标访问)。' },
  { maxP: 30, label: '字符串',       allowed: '只能使用: P25及之前的全部 + string类型, 字符数组, ASCII码, 字符串基本函数(.length()/.size())。' },
  { maxP: 34, label: '函数',         allowed: '只能使用: P30及之前的全部 + 函数(定义/参数/返回值/调用), 局部变量作用域。' },
  { maxP: 40, label: '进制与位运算',  allowed: '只能使用: P34及之前的全部 + 二进制/八进制/十六进制概念, 位运算符(& | ^ ~ << >>)。' },
  { maxP: 43, label: '二维数组',     allowed: '只能使用: P40及之前的全部 + 二维数组(声明/遍历/行列访问)。' },
  { maxP: 48, label: '排序与结构体',  allowed: '只能使用: P43及之前的全部 + sort()函数(#include <algorithm>), 结构体struct, 自定义比较函数。' },
  { maxP: 50, label: '递推',         allowed: '只能使用: P48及之前的全部 + 递推算法(递推公式/状态转移)。' },
  { maxP: 56, label: '枚举+模拟+前缀和', allowed: '只能使用: P50及之前的全部 + 枚举算法, 模拟算法, 前缀和, 差分数组。' },
  { maxP: 62, label: '贪心+排序',    allowed: '只能使用: P56及之前的全部 + 贪心算法, 选择排序, 冒泡排序, 插入排序, 计数排序。' },
  { maxP: 68, label: '数论+二分+队列', allowed: '只能使用: P62及之前的全部 + 质数判断/筛法, 最大公约数gcd, 二分查找, 队列queue, vector容器。' },
];

function getConstraint(order) {
  for (const c of CURRICULUM) {
    if (order <= c.maxP) return { label: c.label, allowed: c.allowed };
  }
  return CURRICULUM[CURRICULUM.length - 1];
}

const FORBIDDEN = `【绝对禁止使用的语法（中小学生信奥规范）】
禁止: map, set, stack, unordered_map, priority_queue（P68前也禁止queue/vector以外的STL）
禁止: 动态规划(DP), 图论, 并查集, 线段树, 树状数组, KMP, 快速幂
禁止: auto, lambda, range-for, nullptr, 引用(&), 指针(*), class/类/对象
禁止: printf/scanf（必须用cin/cout）
禁止: #include <algorithm>（仅P44起且需要sort时可用）
禁止: C++11/14/17新特性（如 auto, decltype, constexpr, initializer_list）`;

// ============================================================
// Main
// ============================================================
const raw = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));
const lessons = [];
for (const stage of (raw.stages || [])) {
  for (const l of (stage.lessons || [])) {
    lessons.push(l);
  }
}

// Collect tasks: problems without code
const tasks = [];
for (const l of lessons) {
  const order = l.order || 1;
  for (const field of ['review', 'inClassCodes', 'inClassQuiz', 'homework', 'extended']) {
    for (const p of (l[field] || [])) {
      if (p.difficulty === 'lecture') continue;  // 讲义题不需要代码
      const code = (p.code || p.answerCode || '').trim();
      if (code.length >= 30) continue;  // already has code
      if (!p.title || !p.description) continue;  // no data to work with
      tasks.push({ lesson: l, problem: p, field, order });
    }
  }
}
console.log(`需生成代码: ${tasks.length} 题`);

// ============================================================
// AI call
// ============================================================
async function generateCode(title, desc, inputFmt, outputFmt, samples, order) {
  const constraint = getConstraint(order);
  const sampleText = (samples || []).map((s, i) =>
    `样例${i + 1}:\n  输入: ${s.in || s.input || ''}\n  输出: ${s.out || s.output || ''}`
  ).join('\n');

  const system = `你是C++信奥教学专家。为下面的题目生成标准参考代码。

【题目信息】
题名: ${title}
描述: ${desc}
输入格式: ${inputFmt || '无'}
输出格式: ${outputFmt || '无'}
${sampleText}

【课次约束 — 当前为第${order}课 (${constraint.label})】
${constraint.allowed}

${FORBIDDEN}

【代码要求】
1. 必须能通过所有样例（仔细验证）
2. 代码要有中文注释，关键行解释算法思路（方便老师教学）
3. 头文件用 #include <bits/stdc++.h>
4. 使用 using namespace std;
5. 4空格缩进，变量名简洁有意义
6. 输出纯代码，不要markdown包裹`;

  const user = '请生成这道题的参考代码';

  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature: 0.2, max_tokens: 2048,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  const d = await r.json();
  let code = (d.choices?.[0]?.message?.content || '').trim();
  // Strip markdown code fences if present
  code = code.replace(/^```(?:cpp|c\+\+)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return code;
}

// ============================================================
// Process
// ============================================================
let done = 0;
let failed = 0;
const BATCH_SAVE = 5;

for (let i = 0; i < tasks.length; i++) {
  const { lesson, problem, field, order } = tasks[i];
  const title = problem.title || '';
  const desc = problem.description || '';
  const inputFmt = problem.inputFormat || '';
  const outputFmt = problem.outputFormat || '';
  const samples = problem.samples || [];

  process.stdout.write(`[${i + 1}/${tasks.length}] P${order} ${title.substring(0, 40)}... `);

  try {
    const code = await generateCode(title, desc, inputFmt, outputFmt, samples, order);
    if (code && code.length >= 30) {
      problem.code = code;
      problem.answerCode = code;
      done++;
      console.log(`✅ ${code.length}chars`);
    } else {
      failed++;
      console.log(`❌ 代码太短`);
    }
  } catch (e) {
    failed++;
    console.log(`❌ ${e.message?.substring(0, 50) || 'error'}`);
  }

  // Periodic save
  if ((i + 1) % BATCH_SAVE === 0 || i === tasks.length - 1) {
    raw.stages.forEach(stage => {
      stage.lessons = stage.lessons.map(l =>
        lessons.find(fl => fl.id === l.id) || l
      );
    });
    writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));
  }
}

// Final save
raw.stages.forEach(stage => {
  stage.lessons = stage.lessons.map(l =>
    lessons.find(fl => fl.id === l.id) || l
  );
});
writeFileSync('shared/data/lessons.json', JSON.stringify(raw, null, 2));

console.log(`\n完成: ${done}/${tasks.length} 成功, ${failed} 失败`);
