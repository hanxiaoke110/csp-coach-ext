/**
 * 教案 Markdown → 课程题目 JSON
 * 用法: node scripts/convert-lesson.js <教案.md> <课程序号> > output.json
 */
import { readFileSync } from 'fs';

const file = process.argv[2];
const num = parseInt(process.argv[3]) || 1;
if (!file) { console.error('用法: node scripts/convert-lesson.js <教案.md> <课程序号>'); process.exit(1); }

const md = readFileSync(file, 'utf-8');
const appendixIdx = md.indexOf('# 附录');
const text = appendixIdx !== -1 ? md.slice(appendixIdx) : md;

// ---- helpers ----
function parseTable(t) {
  const lines = t.trim().split('\n').filter(l => l.includes('|'));
  const data = lines.filter(l => !l.match(/^\|[\s\-:|]+\|$/));
  if (!data.length) return {};
  const r = {};
  for (const l of data) {
    const c = l.split('|').map(x => x.trim()).filter(Boolean);
    if (c.length >= 2) r[c[0].replace(/\*\*/g,'').replace(/[：:]/g,'').trim()] = c.slice(1).join(' ').trim();
  }
  return r;
}

function codeBlocks(t) {
  return [...t.matchAll(/```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/g)].map(m => m[1].trim());
}

function labeledCode(t, labels) {
  for (const lb of labels) {
    const i = t.indexOf(lb); if (i === -1) continue;
    const b = codeBlocks(t.slice(i)); if (b.length) return b[0];
  }
  return '';
}

function extractId(h) { const m = h.match(/(\d{4,})/); return m ? m[1] : ''; }

function extractTitle(h) {
  return h.replace(/^题目\s*\d*\s*[-–—]*\s*\d*\s*/, '')
    .replace(/^OJ题?\s*[①②③④⑤⑥⑦⑧⑨⑩\d]*\s*[-–—]*\s*/, '')
    .replace(/^OJ\d+\s*[-–—]*\s*/, '')
    .replace(/^课后(作业|拓展)\d*\s*[-–—]*\s*/, '')
    .replace(/^温故知新\d+\s*[-–—]*\s*/, '')
    .replace(/^\d+\s*[-–—]*\s*/, '').trim().slice(0, 60);
}

// ---- section type from header text ----
function problemType(h) {
  if (/^课后拓展/.test(h)) return 'extended';
  if (/^课后作业/.test(h)) return 'homework';
  if (/^OJ[题\d]/.test(h) || /^OJ\d/.test(h)) return 'inClassCodes';
  if (/^OJ题/.test(h)) return 'inClassCodes';
  if (/^题目/.test(h) && /拓展/.test(h)) return 'extended';
  if (/^题目/.test(h) && /作业/.test(h)) return 'homework';
  return null; // unknown - skip
}

// ---- extract one problem ----
function extractProblem(section, header, pid, fallbackType) {
  // try table
  const tm = section.match(/\|.+\|.*\n\|[\s\-:|]+\|/);
  const td = tm ? parseTable(section.slice(tm.index)) : {};

  const allCode = codeBlocks(section);
  const refCode = labeledCode(section, ['参考代码','> 参考代码']) || (allCode[0] || '');
  const presetCode = labeledCode(section, ['预置代码','> 预置代码']) || '';

  const desc = td['题目描述'] || td['描述'] || '';
  const inF = td['输入格式'] || td['输入'] || '';
  const outF = td['输出格式'] || td['输出'] || '';
  const inS = td['输入示例'] || td['输入样例'] || td['输入样例 1'] || td['输入样例1'] || td['输入样例 1'] || '';
  const outS = td['输出示例'] || td['输出样例'] || td['输出样例 1'] || td['输出样例1'] || td['输出样例 1'] || '';

  const p = {
    id: `codemao-${pid}`, platform: 'codemao', pid,
    title: extractTitle(header) || `题目 ${pid}`,
    difficulty: 'beginner', tags: [],
    description: desc, inputFormat: inF, outputFormat: outF,
    samples: [], analysis: '', hints: [],
    codeTemplate: presetCode,
    solutionCode: refCode || (allCode[0] || ''),
    commonMistakes: [], teachingTips: '',
  };
  if (inS || outS) p.samples.push({ input: inS, output: outS });
  return p;
}

// ---- main: find all ### problems ----
const allProblems = [];
const sections = text.split(/^###\s+/m).slice(1);

for (const sec of sections) {
  const header = sec.split('\n')[0].trim();
  // Determine type from header name
  let type = problemType(header);
  let pid = extractId(header);

  // If header doesn't indicate type, look at parent ## section
  if (!type) {
    const pos = text.indexOf(sec);
    const before = text.slice(0, Math.max(0, pos - 5));
    const parentH = [...before.matchAll(/^##\s+(.+)$/gm)];
    const parent = parentH.length ? parentH[parentH.length-1][1].trim() : '';
    if (parent.includes('课后拓展') || parent.includes('拓展')) type = 'extended';
    else if (parent.includes('课后作业') || parent.includes('作业')) type = 'homework';
    else if (parent.includes('课中OJ') || parent.includes('OJ')) type = 'inClassCodes';
    else if (parent.includes('温故知新') || parent.includes('小测')) continue;
    else continue;
  }

  // 如果没有数字ID，生成一个
  if (!pid) {
    pid = `L${num}-${type.slice(0,1)}${allProblems.length + 1}`;
  }

  const p = extractProblem(sec, header, pid, type);
  allProblems.push({ type, problem: p });
}

// ---- group by type ----
const result = { inClassCodes: [], homework: [], extended: [] };
for (const { type, problem } of allProblems) {
  result[type].push(problem);
}

const total = result.inClassCodes.length + result.homework.length + result.extended.length;
console.error(`\n📊 第${num}课:`);
console.error(`   📝 课上练习: ${result.inClassCodes.length} 题`);
console.error(`   📋 课后作业: ${result.homework.length} 题`);
console.error(`   📌 课后拓展: ${result.extended.length} 题`);
console.error(`   📦 合计: ${total} 题`);
const all = [...result.inClassCodes, ...result.homework, ...result.extended];
console.error(`   ⚠️  有文字描述: ${all.filter(p => p.description).length}/${total}`);
console.error(`   ✅ 有参考代码: ${all.filter(p => p.solutionCode).length}/${total}`);

const lesson = {
  id: `lesson-${num}`, order: num, title: `第${num}课`, summary: '',
  inClassCodes: result.inClassCodes, homework: result.homework, extended: result.extended,
};

console.log(JSON.stringify(lesson, null, 2));
