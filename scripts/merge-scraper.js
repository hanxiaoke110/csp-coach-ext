/**
 * Merge scraper OJ descriptions into lessons.json
 */
import { readFileSync, writeFileSync } from 'fs';

const scraper = JSON.parse(readFileSync('scraper/output/lessons.json', 'utf-8'));
// Load current lessons - handle both formats
let lessonsData = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));
let lessons;
if (Array.isArray(lessonsData)) {
  lessons = lessonsData;
} else if (lessonsData.stages) {
  // Old format: flatten stages.lessons
  lessons = [];
  lessonsData.stages.forEach(s => {
    (s.lessons || []).forEach(l => lessons.push(l));
  });
}

// Build pid → description map from scraper
const descMap = {};
scraper.stages.forEach(s => {
  s.lessons.forEach(l => {
    ['practice', 'homework', 'extended'].forEach(cat => {
      (l[cat] || []).forEach(p => {
        const pid = p.pid || '';
        if (pid && p.description && p.description.trim()) {
          let desc = p.description || '';
          if (p.inputFormat && p.inputFormat !== '无') desc += '\n【输入格式】\n' + p.inputFormat;
          if (p.outputFormat && p.outputFormat !== '无') desc += '\n【输出格式】\n' + p.outputFormat;
          if (p.analysis && p.analysis !== '无') desc += '\n【解析】\n' + p.analysis;
          if (p.samples && p.samples.length) {
            p.samples.forEach((s, i) => {
              desc += `\n【样例${i + 1}】\n输入：${s.in || ''}\n输出：${s.out || ''}`;
            });
          }
          descMap[pid] = desc;
        }
      });
    });
  });
});

console.log('Description map:', Object.keys(descMap).length, 'entries');

// Update descriptions - handle both old format (practice/homework/extended) and new format (inClassCodes/homework/extended)
let updated = 0;
lessons.forEach(l => {
  const allProblems = [
    ...(l.inClassCodes || []),
    ...(l.practice || []),
    ...(l.homework || []),
    ...(l.extended || [])
  ];
  allProblems.forEach(p => {
    if (!p || !p.title) return;
    const m = p.title ? p.title.match(/(\d{3,6})/) : null;
    if (!m) return;
    const pid = m[1];
    const desc = descMap[pid];
    if (desc) {
      p.description = desc.substring(0, 2000);
      updated++;
    }
  });
});

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));

let have = 0, total = 0;
lessons.forEach(l => {
  const allProbs = [...(l.inClassCodes || []), ...(l.practice || []), ...(l.homework || []), ...(l.extended || [])];
  allProbs.forEach(p => {
    if (!p || !p.title) return;
    total++;
    if ((p.description || '').length > 30) have++;
  });
});

console.log('Updated:', updated);
console.log('Quality:', have, '/', total, '(' + (have / total * 100).toFixed(0) + '%)');
